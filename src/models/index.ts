export type ProviderType = 'github' | 'gitlab' | 'azuredevops'

export type PipelineStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'skipped'
  | 'unknown'

export interface Repo {
  id: string
  name: string
  fullName: string
  provider: ProviderType
  defaultBranch: string
  url: string
}

export interface Pipeline {
  id: string
  name: string
  status: PipelineStatus
  branch: string
  commitSha: string
  commitMessage?: string
  startedAt?: string
  finishedAt?: string
  url: string
  provider: ProviderType
}

export interface Job {
  id: string
  name: string
  stage: string
  status: PipelineStatus
  startedAt?: string
  finishedAt?: string
  duration?: number
  url: string
}
