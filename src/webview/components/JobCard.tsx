import React from 'react'
import type { Job } from '../types'
import { STATUS_COLOR, STATUS_ICON } from './PipelineGraph'

interface Props {
  job: Job
  selected: boolean
  onClick: () => void
}

function formatDuration(sec?: number): string {
  if (sec === undefined) return ''
  if (sec < 60) return `${Math.round(sec)}s`
  return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`
}

export function JobCard({ job, selected, onClick }: Props) {
  const isRunning = job.status === 'running'

  return (
    <div
      className={`job-card${selected ? ' job-card--selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-pressed={selected}
      title={`${job.name} · ${job.status}${job.duration ? ` · ${formatDuration(job.duration)}` : ''}`}
    >
      <span
        className={`job-card__icon${isRunning ? ' spin' : ''}`}
        style={{ color: STATUS_COLOR[job.status] }}
        aria-hidden="true"
      >
        {STATUS_ICON[job.status]}
      </span>
      <div className="job-card__body">
        <span className="job-card__name">{job.name}</span>
        <div className="job-card__meta">
          <span className="job-card__stage">{job.stage}</span>
          {job.duration !== undefined && (
            <span className="job-card__duration">{formatDuration(job.duration)}</span>
          )}
        </div>
      </div>
      <span className="job-card__log-hint" aria-hidden="true">
        {selected ? '▲' : '▼'}
      </span>
    </div>
  )
}
