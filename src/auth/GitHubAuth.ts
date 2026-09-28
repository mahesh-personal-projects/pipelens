import * as vscode from 'vscode'

// Uses VS Code's built-in GitHub authentication provider — no OAuth app registration needed.
const SCOPES = ['repo', 'read:user']

export async function signInGitHub(): Promise<string | undefined> {
  try {
    const session = await vscode.authentication.getSession('github', SCOPES, { createIfNone: true })
    return session.accessToken
  } catch {
    return undefined
  }
}

export async function getGitHubToken(): Promise<string | undefined> {
  try {
    const session = await vscode.authentication.getSession('github', SCOPES, {
      createIfNone: false,
      silent: true,
    })
    return session?.accessToken
  } catch {
    return undefined
  }
}

export async function isGitHubAuthenticated(): Promise<boolean> {
  const token = await getGitHubToken()
  return !!token
}
