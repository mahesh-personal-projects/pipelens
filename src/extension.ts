import * as vscode from 'vscode'
import { AuthManager } from './auth/AuthManager'
import { signInGitHub, getGitHubToken } from './auth/GitHubAuth'
import { signInGitLab } from './auth/GitLabAuth'
import { signInAzureDevOps } from './auth/AzureDevOpsAuth'
import { GitHubProvider } from './providers/github/GitHubProvider'
import { GitLabProvider } from './providers/gitlab/GitLabProvider'
import { AzureDevOpsProvider } from './providers/azuredevops/AzureDevOpsProvider'
import { SidebarProvider } from './views/SidebarProvider'
import { PipelinePanel } from './views/PipelinePanel'
import { PipelensStatusBar } from './views/StatusBarItem'
import type { Repo } from './models'

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const authManager = new AuthManager(context.secrets)
  const statusBar = new PipelensStatusBar()

  const providers = {
    github:       new GitHubProvider(),
    gitlab:       new GitLabProvider(authManager),
    azuredevops:  new AzureDevOpsProvider(authManager),
  }

  const sidebar = new SidebarProvider(providers)

  context.subscriptions.push(
    statusBar,
    vscode.window.registerTreeDataProvider('pipelens.repoTree', sidebar),

    vscode.commands.registerCommand('pipelens.signInGitHub', async () => {
      const token = await signInGitHub()
      if (token) {
        sidebar.refresh()
        void vscode.window.showInformationMessage('Pipelens: Signed in to GitHub')
      }
    }),

    vscode.commands.registerCommand('pipelens.signInGitLab', async () => {
      const token = await signInGitLab(authManager)
      if (token) {
        sidebar.refresh()
        void vscode.window.showInformationMessage('Pipelens: Signed in to GitLab')
      }
    }),

    vscode.commands.registerCommand('pipelens.signInAzureDevOps', async () => {
      const token = await signInAzureDevOps(authManager)
      if (token) {
        sidebar.refresh()
        void vscode.window.showInformationMessage('Pipelens: Signed in to Azure DevOps')
      }
    }),

    vscode.commands.registerCommand('pipelens.signOut', async () => {
      const pick = await vscode.window.showQuickPick(
        [
          { label: '$(github) GitHub',           value: 'github' as const },
          { label: '$(source-control) GitLab',   value: 'gitlab' as const },
          { label: '$(azure) Azure DevOps',       value: 'azuredevops' as const },
        ],
        { title: 'Pipelens: Sign out from which provider?' }
      )
      if (!pick) return
      if (pick.value === 'github') {
        void vscode.window.showInformationMessage(
          'To sign out of GitHub, use the Accounts menu in the bottom-left of VS Code.'
        )
        return
      }
      await authManager.clearToken(pick.value)
      sidebar.refresh()
      void vscode.window.showInformationMessage(`Pipelens: Signed out from ${pick.label}`)
    }),

    vscode.commands.registerCommand('pipelens.refreshRepos', () => sidebar.refresh()),

    vscode.commands.registerCommand('pipelens.openPipelineView', (repo: Repo) => {
      const provider =
        repo.provider === 'github' ? providers.github :
        repo.provider === 'gitlab' ? providers.gitlab :
        providers.azuredevops
      PipelinePanel.createOrShow(context.extensionUri, repo, provider, statusBar)
    }),

    vscode.commands.registerCommand('pipelens.selectRepo', async () => {
      const repos = await sidebar.getAllRepos()
      if (repos.length === 0) {
        void vscode.window.showWarningMessage(
          'Pipelens: No repositories found. Sign in via the Pipelens panel first.'
        )
        return
      }
      const pick = await vscode.window.showQuickPick(
        repos.map((r) => ({
          label: `$(${r.provider === 'github' ? 'github' : 'source-control'}) ${r.name}`,
          description: r.fullName,
          repo: r,
        })),
        { title: 'Pipelens: Select a repository', matchOnDescription: true }
      )
      if (pick) {
        void vscode.commands.executeCommand('pipelens.openPipelineView', pick.repo)
      }
    })
  )

  // Silently restore an existing GitHub session on startup
  const ghToken = await getGitHubToken()
  if (ghToken) sidebar.refresh()
}

export function deactivate(): void {}
