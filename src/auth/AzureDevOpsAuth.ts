import * as vscode from 'vscode'
import type { AuthManager } from './AuthManager'

export async function signInAzureDevOps(authManager: AuthManager): Promise<string | undefined> {
  const cfg = vscode.workspace.getConfiguration('pipelens')
  let orgUrl = cfg.get<string>('azureDevOpsOrgUrl', '').trim().replace(/\/$/, '')

  if (!orgUrl) {
    const entered = await vscode.window.showInputBox({
      title: 'Azure DevOps: Organization URL',
      prompt: 'Enter your Azure DevOps organization URL',
      placeHolder: 'https://dev.azure.com/myorganization',
      ignoreFocusOut: true,
      validateInput: (v) =>
        v.trim().startsWith('https://') ? undefined : 'Must start with https://',
    })
    if (!entered) return undefined
    orgUrl = entered.trim().replace(/\/$/, '')
    await cfg.update('azureDevOpsOrgUrl', orgUrl, vscode.ConfigurationTarget.Global)
  }

  const token = await vscode.window.showInputBox({
    title: `Azure DevOps: Personal Access Token (${orgUrl})`,
    prompt: 'Enter a PAT with "Build (Read)" and "Code (Read)" scopes',
    password: true,
    placeHolder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length < 10 ? 'Token looks too short' : undefined),
  })

  if (!token) return undefined
  await authManager.storeToken('azuredevops', token.trim())
  return token.trim()
}
