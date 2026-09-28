import React, { useEffect, useRef } from 'react'

interface Props {
  jobName: string
  log?: string
  onClose: () => void
}

export function LogViewer({ jobName, log, onClose }: Props) {
  const preRef = useRef<HTMLPreElement>(null)

  // Auto-scroll to bottom when new log content arrives
  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight
    }
  }, [log])

  return (
    <div className="log-viewer">
      <div className="log-viewer__header">
        <span className="log-viewer__title">
          <span aria-hidden="true">▶</span> {jobName}
        </span>
        <button className="log-viewer__close" onClick={onClose} aria-label="Close log panel">
          ✕
        </button>
      </div>
      <pre ref={preRef} className="log-viewer__content" aria-label={`Log output for ${jobName}`}>
        {log ?? 'Fetching log…'}
      </pre>
    </div>
  )
}
