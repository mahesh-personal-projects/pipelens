import * as vscode from 'vscode'
import type { PipelineStatus } from '../models'

const ICONS: Record<PipelineStatus, string> = {
  queued:    '$(clock)',
  running:   '$(sync~spin)',
  success:   '$(check)',
  failed:    '$(x)',
  cancelled: '$(circle-slash)',
  skipped:   '$(debug-step-over)',
  unknown:   '$(question)',
}

export class PipelensStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
    this.item.command = 'pipelens.selectRepo'
    this.item.tooltip = 'Pipelens — click to select a repository'
    this.item.text = '$(git-branch) Pipelens'
    this.item.show()

    if (!vscode.workspace.getConfiguration('pipelens').get<boolean>('showStatusBarItem', true)) {
      this.item.hide()
    }
  }

  update(repoName: string, status: PipelineStatus): void {
    this.item.text = `${ICONS[status]} ${repoName}`
    this.item.backgroundColor =
      status === 'failed'
        ? new vscode.ThemeColor('statusBarItem.errorBackground')
        : undefined
  }

  reset(): void {
    this.item.text = '$(git-branch) Pipelens'
    this.item.backgroundColor = undefined
  }

  dispose(): void {
    this.item.dispose()
  }
}
