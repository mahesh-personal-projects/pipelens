import * as vscode from 'vscode'
import type { IProvider } from '../providers/IProvider'
import type { Repo, Pipeline, Job } from '../models'
import type { PipelensStatusBar } from './StatusBarItem'

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

type OutboundMessage =
  | { type: 'init'; pipeline: Pipeline | null; jobs: Job[] }
  | { type: 'update'; pipeline: Pipeline | null; jobs: Job[] }
  | { type: 'log'; jobId: string; content: string }
  | { type: 'error'; message: string }

type InboundMessage = { type: 'requestLog'; jobId: string }

export class PipelinePanel {
  private static instance: PipelinePanel | undefined

  private readonly panel: vscode.WebviewPanel
  private pollTimer: ReturnType<typeof setInterval> | undefined
  private slowPollActive = false
  private lastNotifiedPipelineId: string | undefined
  private currentRepo: Repo
  private currentProvider: IProvider

  private constructor(
    private readonly extensionUri: vscode.Uri,
    repo: Repo,
    provider: IProvider,
    private readonly statusBar: PipelensStatusBar
  ) {
    this.currentRepo = repo
    this.currentProvider = provider

    this.panel = vscode.window.createWebviewPanel(
      'pipelens.view',
      `Pipelens — ${repo.name}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist', 'webview')],
      }
    )

    this.panel.webview.html = this._buildHtml()
    this.panel.webview.onDidReceiveMessage((msg: InboundMessage) => this._handleInbound(msg))
    this.panel.onDidDispose(() => {
      clearInterval(this.pollTimer)
      PipelinePanel.instance = undefined
      this.statusBar.reset()
    })

    this._startPolling()
  }

  static createOrShow(
    extensionUri: vscode.Uri,
    repo: Repo,
    provider: IProvider,
    statusBar: PipelensStatusBar
  ): void {
    if (PipelinePanel.instance) {
      PipelinePanel.instance._switchTo(repo, provider)
      PipelinePanel.instance.panel.reveal(vscode.ViewColumn.One)
      return
    }
    PipelinePanel.instance = new PipelinePanel(extensionUri, repo, provider, statusBar)
  }

  private _switchTo(repo: Repo, provider: IProvider): void {
    this.currentRepo = repo
    this.currentProvider = provider
    this.panel.title = `Pipelens — ${repo.name}`
    this.slowPollActive = false
    this.lastNotifiedPipelineId = undefined
    clearInterval(this.pollTimer)
    this._startPolling()
  }

  private _startPolling(): void {
    const intervalMs = this._activePollMs()
    void this._fetchAndBroadcast('init')
    this.pollTimer = setInterval(() => void this._fetchAndBroadcast('update'), intervalMs)
  }

  private _activePollMs(): number {
    return vscode.workspace.getConfiguration('pipelens').get<number>('pollIntervalSeconds', 10) * 1000
  }

  private async _fetchAndBroadcast(type: 'init' | 'update'): Promise<void> {
    try {
      const pipeline = await this.currentProvider.getLatestPipeline(this.currentRepo)
      const jobs = pipeline
        ? await this.currentProvider.getPipelineJobs(this.currentRepo, pipeline)
        : []

      if (pipeline) {
        this.statusBar.update(this.currentRepo.name, pipeline.status)
        this._maybeNotify(pipeline)
      }

      const msg: OutboundMessage = { type, pipeline, jobs }
      void this.panel.webview.postMessage(msg)

      // Back off to 30s polling once the pipeline reaches a terminal state
      const terminal = pipeline && ['success', 'failed', 'cancelled', 'skipped'].includes(pipeline.status)
      if (terminal && !this.slowPollActive) {
        this.slowPollActive = true
        clearInterval(this.pollTimer)
        this.pollTimer = setInterval(() => void this._fetchAndBroadcast('update'), 30_000)
      } else if (!terminal && this.slowPollActive) {
        // Pipeline re-triggered — go back to fast polling
        this.slowPollActive = false
        clearInterval(this.pollTimer)
        this.pollTimer = setInterval(() => void this._fetchAndBroadcast('update'), this._activePollMs())
      }
    } catch (err) {
      const msg: OutboundMessage = { type: 'error', message: String(err) }
      void this.panel.webview.postMessage(msg)
    }
  }

  private _maybeNotify(pipeline: Pipeline): void {
    if (this.lastNotifiedPipelineId === pipeline.id) return
    if (!vscode.workspace.getConfiguration('pipelens').get<boolean>('notifyOnComplete', true)) return

    if (pipeline.status === 'success') {
      this.lastNotifiedPipelineId = pipeline.id
      void vscode.window.showInformationMessage(
        `Pipelens: Pipeline passed on ${pipeline.branch}`,
        'View'
      ).then((choice) => { if (choice === 'View') this.panel.reveal() })
    } else if (pipeline.status === 'failed') {
      this.lastNotifiedPipelineId = pipeline.id
      void vscode.window.showErrorMessage(
        `Pipelens: Pipeline failed on ${pipeline.branch}`,
        'View Details'
      ).then((choice) => { if (choice === 'View Details') this.panel.reveal() })
    }
  }

  private async _handleInbound(msg: InboundMessage): Promise<void> {
    if (msg.type !== 'requestLog') return

    try {
      const pipeline = await this.currentProvider.getLatestPipeline(this.currentRepo)
      if (!pipeline) return
      const jobs = await this.currentProvider.getPipelineJobs(this.currentRepo, pipeline)
      const job = jobs.find((j) => j.id === msg.jobId)
      if (!job) return
      const content = await this.currentProvider.getJobLog(this.currentRepo, job)
      const reply: OutboundMessage = { type: 'log', jobId: msg.jobId, content }
      void this.panel.webview.postMessage(reply)
    } catch (err) {
      const reply: OutboundMessage = { type: 'error', message: String(err) }
      void this.panel.webview.postMessage(reply)
    }
  }

  private _buildHtml(): string {
    const { webview } = this.panel
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'index.js')
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'assets', 'index.css')
    )
    const nonce = getNonce()

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource} 'unsafe-inline';
             script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>Pipelens</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`
  }
}
