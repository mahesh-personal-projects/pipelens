import type { AuthManager } from '../../auth/AuthManager'
import type { IProvider } from '../IProvider'
import type { Repo, Pipeline, Job, PipelineStatus } from '../../models'
import { GitLabApi } from './GitLabApi'

function mapStatus(status: string): PipelineStatus {
  const map: Record<string, PipelineStatus> = {
    created: 'queued',
    waiting_for_resource: 'queued',
    preparing: 'queued',
    pending: 'queued',
    running: 'running',
    success: 'success',
    failed: 'failed',
    canceled: 'cancelled',
    skipped: 'skipped',
    manual: 'skipped',
    scheduled: 'queued',
  }
  return map[status] ?? 'unknown'
}

export class GitLabProvider implements IProvider {
  private api: GitLabApi

  constructor(private readonly authManager: AuthManager) {
    this.api = new GitLabApi(authManager)
  }

  async isAuthenticated(): Promise<boolean> {
    return this.authManager.hasToken('gitlab')
  }

  async listRepos(): Promise<Repo[]> {
    const raw = await this.api.get<any[]>(
      '/projects?membership=true&order_by=last_activity_at&per_page=100'
    )
    return raw.map((p) => ({
      id: String(p.id),
      name: p.name as string,
      fullName: p.path_with_namespace as string,
      provider: 'gitlab' as const,
      defaultBranch: (p.default_branch as string | undefined) ?? 'main',
      url: p.web_url as string,
    }))
  }

  async getLatestPipeline(repo: Repo): Promise<Pipeline | null> {
    try {
      const pipelines = await this.api.get<any[]>(
        `/projects/${encodeURIComponent(repo.fullName)}/pipelines?per_page=1`
      )
      const p = pipelines[0]
      if (!p) return null

      const detail = await this.api.get<any>(
        `/projects/${encodeURIComponent(repo.fullName)}/pipelines/${p.id}`
      )

      return {
        id: String(detail.id),
        name: `Pipeline #${detail.id}`,
        status: mapStatus(detail.status),
        branch: detail.ref as string,
        commitSha: (detail.sha as string).slice(0, 7),
        commitMessage: detail.detailed_status?.label as string | undefined,
        startedAt: detail.created_at as string | undefined,
        finishedAt: detail.finished_at as string | null ?? undefined,
        url: detail.web_url as string,
        provider: 'gitlab',
      }
    } catch {
      return null
    }
  }

  async getPipelineJobs(repo: Repo, pipeline: Pipeline): Promise<Job[]> {
    const jobs = await this.api.get<any[]>(
      `/projects/${encodeURIComponent(repo.fullName)}/pipelines/${pipeline.id}/jobs?per_page=100`
    )
    return jobs.map((j) => ({
      id: String(j.id),
      name: j.name as string,
      stage: j.stage as string,
      status: mapStatus(j.status),
      startedAt: j.started_at as string | null ?? undefined,
      finishedAt: j.finished_at as string | null ?? undefined,
      duration: (j.duration as number | null) ?? undefined,
      url: j.web_url as string,
    }))
  }

  async getJobLog(repo: Repo, job: Job): Promise<string> {
    try {
      return await this.api.getText(
        `/projects/${encodeURIComponent(repo.fullName)}/jobs/${job.id}/trace`
      )
    } catch {
      return 'Log not available for this job.'
    }
  }
}
