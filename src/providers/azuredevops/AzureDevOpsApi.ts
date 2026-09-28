import * as vscode from 'vscode'
import type { AuthManager } from '../../auth/AuthManager'

const API_VERSION = 'api-version=7.0'

export class AzureDevOpsApi {
  constructor(private readonly authManager: AuthManager) {}

  get orgUrl(): string {
    return vscode.workspace
      .getConfiguration('pipelens')
      .get<string>('azureDevOpsOrgUrl', '')
      .trim()
      .replace(/\/$/, '')
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await this.authManager.getToken('azuredevops')
    // Azure DevOps PAT auth: Basic with empty username and PAT as password
    const encoded = token ? Buffer.from(`:${token}`).toString('base64') : ''
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(encoded ? { Authorization: `Basic ${encoded}` } : {}),
    }
  }

  async get<T>(path: string): Promise<T> {
    const url = path.startsWith('https://') ? path : `${this.orgUrl}${path}`
    const sep = url.includes('?') ? '&' : '?'
    const res = await fetch(`${url}${sep}${API_VERSION}`, { headers: await this.headers() })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Azure DevOps API ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.json() as Promise<T>
  }

  async getText(path: string): Promise<string> {
    const url = path.startsWith('https://') ? path : `${this.orgUrl}${path}`
    const sep = url.includes('?') ? '&' : '?'
    const res = await fetch(`${url}${sep}${API_VERSION}`, {
      headers: { ...await this.headers(), Accept: 'text/plain' },
    })
    if (!res.ok) throw new Error(`Azure DevOps API ${res.status}: ${url}`)
    return res.text()
  }
}
