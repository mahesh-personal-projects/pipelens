export type ProviderType = 'github' | 'gitlab' | 'azuredevops'

export type PipelineStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'skipped'
  | 'unknown'

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

export type InboundMessage =
  | { type: 'init'; pipeline: Pipeline | null; jobs: Job[] }
  | { type: 'update'; pipeline: Pipeline | null; jobs: Job[] }
  | { type: 'log'; jobId: string; content: string }
  | { type: 'error'; message: string }
