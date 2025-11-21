/**
 * EventStreamPanel Component
 * Displays auto-scrolling event feed with filtering capabilities
 */

import { useEffect, useRef, useState } from 'react'

// Simple inline SVG icons
const FilterIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
  </svg>
)

const AlertCircleIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
  </svg>
)

const CheckCircleIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
  </svg>
)

const ClockIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00-.293.707l-2.707 2.707a1 1 0 101.414 1.414L9 11.414V6z" clipRule="evenodd"/>
  </svg>
)

const ZapIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0110 2v5H6a1 1 0 00-.82 1.573l6.92 8.4a1 1 0 001.82-.753L13 13h5a1 1 0 00.82-1.573l-6.92-8.4z" clipRule="evenodd"/>
  </svg>
)

interface WorkflowEvent {
  id: string
  workflow_id: string
  event_type: string
  payload: Record<string, any>
  timestamp: string
  trace_id: string | null
}

interface EventStreamPanelProps {
  events?: WorkflowEvent[]
  maxEvents?: number
  autoScroll?: boolean
}

type EventFilter = 'all' | 'completed' | 'failed' | 'started'

export default function EventStreamPanel({
  events = [],
  maxEvents = 50,
  autoScroll = true
}: EventStreamPanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<EventFilter>('all')
  const [filteredEvents, setFilteredEvents] = useState<WorkflowEvent[]>(events)

  // Filter events
  useEffect(() => {
    let filtered = events
    if (filter !== 'all') {
      filtered = events.filter(e =>
        e.event_type.toLowerCase().includes(filter.toLowerCase())
      )
    }
    setFilteredEvents(filtered.slice(0, maxEvents))
  }, [events, filter, maxEvents])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [filteredEvents, autoScroll])

  const getEventIcon = (eventType: string) => {
    const type = eventType.toLowerCase()
    if (type.includes('failed') || type.includes('error')) {
      return <AlertCircleIcon className="w-4 h-4 text-red-500" />
    }
    if (type.includes('completed') || type.includes('success')) {
      return <CheckCircleIcon className="w-4 h-4 text-green-500" />
    }
    if (type.includes('started') || type.includes('created')) {
      return <ZapIcon className="w-4 h-4 text-blue-500" />
    }
    return <ClockIcon className="w-4 h-4 text-gray-400" />
  }

  const getEventColor = (eventType: string) => {
    const type = eventType.toLowerCase()
    if (type.includes('failed') || type.includes('error')) {
      return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
    }
    if (type.includes('completed') || type.includes('success')) {
      return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
    }
    if (type.includes('started') || type.includes('created')) {
      return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
    }
    return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-96">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Event Stream</h3>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as EventFilter)}
                className="appearance-none bg-white dark:bg-gray-800 px-3 py-1 rounded text-sm border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white pr-8"
              >
                <option value="all">All Events</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="started">Started</option>
              </select>
              <div className="absolute right-2 top-1.5 pointer-events-none w-4 h-4 text-gray-500">
                <FilterIcon className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Events Container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto space-y-1 p-3"
      >
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <p className="text-sm">No events yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Events will appear here as workflows progress</p>
            </div>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`p-2 rounded-lg border transition-colors text-xs ${getEventColor(event.event_type)}`}
            >
              <div className="flex items-start space-x-2">
                {getEventIcon(event.event_type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <p className="font-mono text-gray-900 dark:text-white truncate">
                      {event.event_type}
                    </p>
                    <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap ml-1">
                      {new Date(event.timestamp).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                  {event.workflow_id && (
                    <p className="text-gray-600 dark:text-gray-400 truncate">
                      Workflow: {event.workflow_id.slice(0, 8)}...
                    </p>
                  )}
                  {event.trace_id && (
                    <p className="text-gray-600 dark:text-gray-400 truncate">
                      Trace: {event.trace_id.slice(0, 8)}...
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {filteredEvents.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400">
          Showing {filteredEvents.length} of {events.length} events
        </div>
      )}
    </div>
  )
}
