import React from 'react'
import type { Pipeline, Job, PipelineStatus } from '../types'
import { JobCard } from './JobCard'

interface Props {
  pipeline: Pipeline
  jobs: Job[]
  selectedJobId: string | null
  onSelectJob: (id: string) => void
}

export const STATUS_COLOR: Record<PipelineStatus, string> = {
  queued:    'var(--vscode-charts-yellow)',
  running:   'var(--vscode-charts-blue)',
  success:   'var(--vscode-charts-green)',
  failed:    'var(--vscode-charts-red)',
  cancelled: 'var(--vscode-disabledForeground)',
  skipped:   'var(--vscode-disabledForeground)',
  unknown:   'var(--vscode-disabledForeground)',
}

export const STATUS_ICON: Record<PipelineStatus, string> = {
  queued:    '◌',
  running:   '◎',
  success:   '✓',
  failed:    '✗',
  cancelled: '⊘',
  skipped:   '⤳',
  unknown:   '?',
}

function timeAgo(iso?: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function groupByStage(jobs: Job[]): Map<string, Job[]> {
  const map = new Map<string, Job[]>()
  for (const job of jobs) {
    const arr = map.get(job.stage) ?? []
    arr.push(job)
    map.set(job.stage, arr)
  }
  return map
}

function stageStatus(jobs: Job[]): PipelineStatus {
  if (jobs.some((j) => j.status === 'failed')) return 'failed'
  if (jobs.some((j) => j.status === 'running')) return 'running'
  if (jobs.some((j) => j.status === 'queued')) return 'queued'
  if (jobs.every((j) => j.status === 'success')) return 'success'
  if (jobs.every((j) => ['cancelled', 'skipped'].includes(j.status))) return 'cancelled'
  return 'unknown'
}

export function PipelineGraph({ pipeline, jobs, selectedJobId, onSelectJob }: Props) {
  const stages = groupByStage(jobs)
  const stageNames = Array.from(stages.keys())

  return (
    <div className="pipeline-graph">
      {/* ── Header ── */}
      <div className="pipeline-header">
        <div className="pipeline-meta">
          <span className="pipeline-branch">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
              <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 019 8.5H7a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 017 7h2a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25z" />
            </svg>
            {pipeline.branch}
          </span>
          <span className="pipeline-sha">{pipeline.commitSha}</span>
          {pipeline.commitMessage && (
            <span className="pipeline-commit">{pipeline.commitMessage}</span>
          )}
        </div>
        <div className="pipeline-badge" style={{ color: STATUS_COLOR[pipeline.status] }}>
          <span className={pipeline.status === 'running' ? 'spin' : ''}>
            {STATUS_ICON[pipeline.status]}
          </span>
          <span className="pipeline-badge-label">{pipeline.status}</span>
          <span className="pipeline-time">{timeAgo(pipeline.startedAt)}</span>
        </div>
      </div>

      {/* ── Stage flow ── */}
      {stageNames.length > 0 && (
        <div className="stage-flow">
          {stageNames.map((stage, i) => {
            const ss = stageStatus(stages.get(stage)!)
            return (
              <React.Fragment key={stage}>
                <div className="stage-pill" style={{ borderColor: STATUS_COLOR[ss], color: STATUS_COLOR[ss] }}>
                  <span className={ss === 'running' ? 'spin' : ''}>{STATUS_ICON[ss]}</span>
                  <span>{stage}</span>
                </div>
                {i < stageNames.length - 1 && <span className="stage-arrow" aria-hidden="true">→</span>}
              </React.Fragment>
            )
          })}
        </div>
      )}

      {/* ── Jobs grid ── */}
      {jobs.length > 0 ? (
        <div className="jobs-grid">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              selected={job.id === selectedJobId}
              onClick={() => onSelectJob(job.id)}
            />
          ))}
        </div>
      ) : (
        <p className="jobs-empty">No jobs found for this pipeline run.</p>
      )}
    </div>
  )
}
