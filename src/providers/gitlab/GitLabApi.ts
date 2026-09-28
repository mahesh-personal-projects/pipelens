import * as vscode from 'vscode'
import type { AuthManager } from '../../auth/AuthManager'

export class GitLabApi {
  constructor(private readonly authManager: AuthManager) {}

  private get baseUrl(): string {
    return vscode.workspace
      .getConfiguration('pipelens')
      .get<string>('gitlabBaseUrl', 'https://gitlab.com')
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await this.authManager.getToken('gitlab')
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'PRIVATE-TOKEN': token } : {}),
    }
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v4${path}`, {
      headers: await this.headers(),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`GitLab API ${res.status} ${path}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  async getText(path: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/v4${path}`, {
      headers: await this.headers(),
    })
    if (!res.ok) throw new Error(`GitLab API ${res.status} ${path}`)
    return res.text()
  }
}
