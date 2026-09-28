import * as vscode from 'vscode'
import type { IProvider } from '../providers/IProvider'
import type { Repo } from '../models'

type Providers = { github: IProvider; gitlab: IProvider; azuredevops: IProvider }

const PROVIDER_ICON: Record<string, string> = {
  github: 'github',
  gitlab: 'source-control',
  azuredevops: 'azure',
}

class RepoItem extends vscode.TreeItem {
  constructor(public readonly repo: Repo) {
    super(repo.name, vscode.TreeItemCollapsibleState.None)
    this.description = repo.fullName
    this.tooltip = new vscode.MarkdownString(`**${repo.fullName}**\n\n${repo.url}`)
    this.iconPath = new vscode.ThemeIcon(PROVIDER_ICON[repo.provider] ?? 'source-control')
    this.command = {
      command: 'pipelens.openPipelineView',
      title: 'Open Pipeline View',
      arguments: [repo],
    }
    this.contextValue = 'pipelens.repo'
  }
}

class ProviderItem extends vscode.TreeItem {
  constructor(
    public readonly providerLabel: string,
    public readonly children: RepoItem[],
    authenticated: boolean
  ) {
    super(
      providerLabel,
      authenticated && children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    )
    this.iconPath = new vscode.ThemeIcon(authenticated ? 'account' : 'lock')
    this.description = authenticated ? `${children.length} repo${children.length !== 1 ? 's' : ''}` : 'Not signed in'
    this.contextValue = authenticated ? 'pipelens.providerAuth' : 'pipelens.providerUnauth'

    if (!authenticated) {
      this.command = {
        command: `pipelens.signIn${providerLabel}`,
        title: `Sign in to ${providerLabel}`,
      }
    }
  }
}

type TreeNode = ProviderItem | RepoItem

export class SidebarProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private repoCache: Repo[] = []

  constructor(private readonly providers: Providers) {}

  refresh(): void {
    this.repoCache = []
    this._onDidChangeTreeData.fire(undefined)
  }

  async getAllRepos(): Promise<Repo[]> {
    if (this.repoCache.length > 0) return this.repoCache
    const [ghAuth, glAuth, adoAuth] = await Promise.all([
      this.providers.github.isAuthenticated(),
      this.providers.gitlab.isAuthenticated(),
      this.providers.azuredevops.isAuthenticated(),
    ])
    const [ghRepos, glRepos, adoRepos] = await Promise.all([
      ghAuth  ? this.providers.github.listRepos().catch(() => [] as Repo[])       : Promise.resolve([] as Repo[]),
      glAuth  ? this.providers.gitlab.listRepos().catch(() => [] as Repo[])       : Promise.resolve([] as Repo[]),
      adoAuth ? this.providers.azuredevops.listRepos().catch(() => [] as Repo[])  : Promise.resolve([] as Repo[]),
    ])
    this.repoCache = [...ghRepos, ...glRepos, ...adoRepos]
    return this.repoCache
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (element instanceof ProviderItem) {
      return element.children
    }

    const [ghAuth, glAuth, adoAuth] = await Promise.all([
      this.providers.github.isAuthenticated(),
      this.providers.gitlab.isAuthenticated(),
      this.providers.azuredevops.isAuthenticated(),
    ])

    const [ghRepos, glRepos, adoRepos] = await Promise.all([
      ghAuth  ? this.providers.github.listRepos().catch(() => [] as Repo[])       : Promise.resolve([] as Repo[]),
      glAuth  ? this.providers.gitlab.listRepos().catch(() => [] as Repo[])       : Promise.resolve([] as Repo[]),
      adoAuth ? this.providers.azuredevops.listRepos().catch(() => [] as Repo[])  : Promise.resolve([] as Repo[]),
    ])

    this.repoCache = [...ghRepos, ...glRepos, ...adoRepos]

    return [
      new ProviderItem('GitHub',        ghRepos.map((r)  => new RepoItem(r)), ghAuth),
      new ProviderItem('GitLab',        glRepos.map((r)  => new RepoItem(r)), glAuth),
      new ProviderItem('AzureDevOps',   adoRepos.map((r) => new RepoItem(r)), adoAuth),
    ]
  }
}
