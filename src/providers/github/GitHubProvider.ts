import { isGitHubAuthenticated } from '../../auth/GitHubAuth'
import type { IProvider } from '../IProvider'
import type { Repo, Pipeline, Job, PipelineStatus } from '../../models'
import { GitHubApi } from './GitHubApi'

function mapStatus(conclusion: string | null, status: string): PipelineStatus {
  if (status === 'queued') return 'queued'
  if (status === 'in_progress') return 'running'
  switch (conclusion) {
    case 'success': return 'success'
    case 'failure': return 'failed'
    case 'cancelled': return 'cancelled'
    case 'skipped': return 'skipped'
    case 'timed_out': return 'failed'
    default: return 'unknown'
  }
}

export class GitHubProvider implements IProvider {
  private api = new GitHubApi()

  async isAuthenticated(): Promise<boolean> {
    return isGitHubAuthenticated()
  }

  async listRepos(): Promise<Repo[]> {
    const raw = await this.api.get<any[]>(
      '/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator'
    )
    return raw.map((r) => ({
      id: String(r.id),
      name: r.name as string,
      fullName: r.full_name as string,
      provider: 'github' as const,
      defaultBranch: (r.default_branch as string) ?? 'main',
      url: r.html_url as string,
    }))
  }

  async getLatestPipeline(repo: Repo): Promise<Pipeline | null> {
    try {
      const res = await this.api.get<{ workflow_runs: any[] }>(
        `/repos/${repo.fullName}/actions/runs?per_page=1`
      )
      const run = res.workflow_runs[0]
      if (!run) return null

      return {
        id: String(run.id),
        name: run.name as string,
        status: mapStatus(run.conclusion, run.status),
        branch: run.head_branch as string,
        commitSha: (run.head_sha as string).slice(0, 7),
        commitMessage: (run.head_commit?.message as string | undefined)?.split('\n')[0],
        startedAt: run.run_started_at as string | undefined,
        finishedAt: run.updated_at as string | undefined,
        url: run.html_url as string,
        provider: 'github',
      }
    } catch {
      return null
    }
  }

  async getPipelineJobs(repo: Repo, pipeline: Pipeline): Promise<Job[]> {
    const res = await this.api.get<{ jobs: any[] }>(
      `/repos/${repo.fullName}/actions/runs/${pipeline.id}/jobs`
    )
    return res.jobs.map((j) => ({
      id: String(j.id),
      name: j.name as string,
      stage: (j.workflow_name as string | undefined) ?? 'build',
      status: mapStatus(j.conclusion, j.status),
      startedAt: j.started_at as string | undefined,
      finishedAt: j.completed_at as string | undefined,
      duration:
        j.started_at && j.completed_at
          ? (new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000
          : undefined,
      url: j.html_url as string,
    }))
  }

  async getJobLog(repo: Repo, job: Job): Promise<string> {
    try {
      return await this.api.getText(`/repos/${repo.fullName}/actions/jobs/${job.id}/logs`)
    } catch {
      return 'Log not available for this job.'
    }
  }
}
