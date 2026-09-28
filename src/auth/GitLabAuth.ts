import * as vscode from 'vscode'
import type { AuthManager } from './AuthManager'

export async function signInGitLab(authManager: AuthManager): Promise<string | undefined> {
  const gitlabUrl = vscode.workspace
    .getConfiguration('pipelens')
    .get<string>('gitlabBaseUrl', 'https://gitlab.com')

  const token = await vscode.window.showInputBox({
    title: `Sign in to GitLab (${gitlabUrl})`,
    prompt: 'Enter a Personal Access Token with the "api" scope',
    password: true,
    placeHolder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length < 10 ? 'Token looks too short' : undefined),
  })

  if (!token) return undefined

  await authManager.storeToken('gitlab', token.trim())
  return token.trim()
}
