import * as vscode from 'vscode'
import type { ProviderType } from '../models'

export class AuthManager {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async storeToken(provider: ProviderType, token: string): Promise<void> {
    await this.secrets.store(`pipelens.token.${provider}`, token)
  }

  async getToken(provider: ProviderType): Promise<string | undefined> {
    return this.secrets.get(`pipelens.token.${provider}`)
  }

  async clearToken(provider: ProviderType): Promise<void> {
    await this.secrets.delete(`pipelens.token.${provider}`)
  }

  async hasToken(provider: ProviderType): Promise<boolean> {
    const token = await this.getToken(provider)
    return !!token && token.length > 0
  }
}
