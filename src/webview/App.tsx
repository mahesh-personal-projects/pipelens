import React, { useEffect, useReducer } from 'react'
import type { Pipeline, Job, InboundMessage } from './types'
import { PipelineGraph } from './components/PipelineGraph'
import { LogViewer } from './components/LogViewer'

declare function acquireVsCodeApi(): {
  postMessage: (msg: unknown) => void
  getState: () => unknown
  setState: (state: unknown) => void
}
const vscode = acquireVsCodeApi()

interface State {
  phase: 'loading' | 'empty' | 'loaded' | 'error'
  pipeline: Pipeline | null
  jobs: Job[]
  logs: Record<string, string>
  selectedJobId: string | null
  error: string | null
}

type Action =
  | { type: 'DATA'; pipeline: Pipeline | null; jobs: Job[] }
  | { type: 'LOG'; jobId: string; content: string }
  | { type: 'ERROR'; message: string }
  | { type: 'SELECT_JOB'; jobId: string }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'DATA':
      return {
        ...state,
        phase: action.pipeline ? 'loaded' : 'empty',
        pipeline: action.pipeline,
        jobs: action.jobs,
      }
    case 'LOG':
      return { ...state, logs: { ...state.logs, [action.jobId]: action.content } }
    case 'ERROR':
      return { ...state, phase: 'error', error: action.message }
    case 'SELECT_JOB': {
      const toggled = state.selectedJobId === action.jobId ? null : action.jobId
      if (toggled && !state.logs[toggled]) {
        vscode.postMessage({ type: 'requestLog', jobId: toggled })
      }
      return { ...state, selectedJobId: toggled }
    }
  }
}

const initial: State = {
  phase: 'loading',
  pipeline: null,
  jobs: [],
  logs: {},
  selectedJobId: null,
  error: null,
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initial)

  useEffect(() => {
    const handler = (event: MessageEvent<InboundMessage>) => {
      const msg = event.data
      switch (msg.type) {
        case 'init':
        case 'update':
          dispatch({ type: 'DATA', pipeline: msg.pipeline, jobs: msg.jobs })
          break
        case 'log':
          dispatch({ type: 'LOG', jobId: msg.jobId, content: msg.content })
          break
        case 'error':
          dispatch({ type: 'ERROR', message: msg.message })
          break
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  if (state.phase === 'loading') {
    return (
      <div className="state-center">
        <div className="spinner" />
        <p>Loading pipeline…</p>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div className="state-center state-error">
        <span className="state-icon">✕</span>
        <p>{state.error}</p>
      </div>
    )
  }

  if (state.phase === 'empty' || !state.pipeline) {
    return (
      <div className="state-center">
        <span className="state-icon">⊘</span>
        <p>No pipeline runs found for this repository.</p>
      </div>
    )
  }

  return (
    <div className="app">
      <PipelineGraph
        pipeline={state.pipeline}
        jobs={state.jobs}
        selectedJobId={state.selectedJobId}
        onSelectJob={(id) => dispatch({ type: 'SELECT_JOB', jobId: id })}
      />
      {state.selectedJobId && (
        <LogViewer
          jobName={state.jobs.find((j) => j.id === state.selectedJobId)?.name ?? ''}
          log={state.logs[state.selectedJobId]}
          onClose={() => dispatch({ type: 'SELECT_JOB', jobId: state.selectedJobId! })}
        />
      )}
    </div>
  )
}
