import type { Repo, Pipeline, Job } from '../models'

export interface IProvider {
  isAuthenticated(): Promise<boolean>
  listRepos(): Promise<Repo[]>
  getLatestPipeline(repo: Repo): Promise<Pipeline | null>
  getPipelineJobs(repo: Repo, pipeline: Pipeline): Promise<Job[]>
  getJobLog(repo: Repo, job: Job): Promise<string>
}
