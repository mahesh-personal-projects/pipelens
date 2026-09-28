import type { AuthManager } from '../../auth/AuthManager'
import type { IProvider } from '../IProvider'
import type { Repo, Pipeline, Job, PipelineStatus } from '../../models'
import { AzureDevOpsApi } from './AzureDevOpsApi'

function mapStatus(state: string, result: string | null): PipelineStatus {
  if (state === 'inProgress') return 'running'
  if (state === 'notStarted') return 'queued'
  if (state === 'canceling') return 'cancelled'
  switch (result) {
    case 'succeeded': return 'success'
    case 'failed':
    case 'partiallySucceeded': return 'failed'
    case 'canceled': return 'cancelled'
    default: return 'unknown'
  }
}

export class AzureDevOpsProvider implements IProvider {
  private api: AzureDevOpsApi

  constructor(private readonly authManager: AuthManager) {
    this.api = new AzureDevOpsApi(authManager)
  }

  async isAuthenticated(): Promise<boolean> {
    return this.authManager.hasToken('azuredevops')
  }

  async listRepos(): Promise<Repo[]> {
    const { orgUrl } = this.api
    if (!orgUrl) return []

    const res = await this.api.get<{ value: any[] }>('/_apis/projects?$top=100')
    return res.value.map((p) => ({
      id: p.id as string,
      name: p.name as string,
      fullName: p.name as string,
      provider: 'azuredevops' as const,
      defaultBranch: 'main',
      url: `${orgUrl}/${encodeURIComponent(p.name as string)}`,
    }))
  }

  async getLatestPipeline(repo: Repo): Promise<Pipeline | null> {
    try {
      const res = await this.api.get<{ value: any[] }>(
        `/${encodeURIComponent(repo.fullName)}/_apis/build/builds?$top=1`
      )
      const build = res.value[0]
      if (!build) return null

      return {
        id: String(build.id),
        name: (build.definition?.name as string | undefined) ?? `Build #${build.id}`,
        status: mapStatus(build.status, build.result ?? null),
        branch: (build.sourceBranch as string).replace('refs/heads/', ''),
        commitSha: (build.sourceVersion as string).slice(0, 7),
        commitMessage: build.triggerInfo?.['ci.message'] as string | undefined,
        startedAt: build.startTime as string | undefined,
        finishedAt: build.finishTime as string | undefined,
        url: (build._links?.web?.href as string | undefined) ?? repo.url,
        provider: 'azuredevops',
      }
    } catch {
      return null
    }
  }

  async getPipelineJobs(repo: Repo, pipeline: Pipeline): Promise<Job[]> {
    const res = await this.api.get<{ records: any[] }>(
      `/${encodeURIComponent(repo.fullName)}/_apis/build/builds/${pipeline.id}/timeline`
    )

    // Resolve stage names from parent records for display in the stage flow
    const recordMap = new Map<string, any>(res.records.map((r) => [r.id as string, r]))

    return res.records
      .filter((r) => r.type === 'Job')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((r) => {
        const parent = r.parentId ? recordMap.get(r.parentId as string) : undefined
        const stage = (parent?.name as string | undefined) ?? 'build'
        return {
          id: r.id as string,
          name: r.name as string,
          stage,
          status: mapStatus(r.state, r.result ?? null),
          startedAt: (r.startTime as string | null) ?? undefined,
          finishedAt: (r.finishTime as string | null) ?? undefined,
          duration:
            r.startTime && r.finishTime
              ? (new Date(r.finishTime).getTime() - new Date(r.startTime).getTime()) / 1000
              : undefined,
          url: pipeline.url,
        }
      })
  }

  async getJobLog(repo: Repo, job: Job): Promise<string> {
    try {
      // Re-fetch the latest pipeline to confirm build ID, then look up
      // the timeline record's log ID (timeline records carry a `log.id`).
      const pipeline = await this.getLatestPipeline(repo)
      if (!pipeline) return 'Log not available.'

      const timeline = await this.api.get<{ records: any[] }>(
        `/${encodeURIComponent(repo.fullName)}/_apis/build/builds/${pipeline.id}/timeline`
      )
      const record = timeline.records.find((r) => r.id === job.id)
      const logId = record?.log?.id as number | undefined
      if (!logId) return 'Log not yet available for this job.'

      return await this.api.getText(
        `/${encodeURIComponent(repo.fullName)}/_apis/build/builds/${pipeline.id}/logs/${logId}`
      )
    } catch {
      return 'Log not available for this job.'
    }
  }
}
