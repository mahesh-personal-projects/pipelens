import { getGitHubToken } from '../../auth/GitHubAuth'

const BASE = 'https://api.github.com'

export class GitHubApi {
  private async headers(): Promise<Record<string, string>> {
    const token = await getGitHubToken()
    return {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { headers: await this.headers() })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`GitHub API ${res.status} ${path}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  async getText(path: string): Promise<string> {
    const res = await fetch(`${BASE}${path}`, {
      headers: { ...await this.headers(), Accept: 'application/vnd.github.raw' },
      // GitHub log redirects — follow them
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`GitHub API ${res.status} ${path}`)
    return res.text()
  }
}
