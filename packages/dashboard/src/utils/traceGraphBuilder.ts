/**
 * Utilities for building React Flow graph data from trace spans
 */
import { WORKFLOW_STATUS } from '@agentic-sdlc/shared-types'

export interface TraceSpan {
  span_id: string
  parent_span_id: string | null
  trace_id: string
  entity_type: 'Workflow' | 'Task'
  entity_id: string
  status: string
  created_at: string
  completed_at: string | null
  duration_ms: number | null
}

export interface FlowNode {
  id: string
  data: {
    label: string
    status: string
    duration: string
    entityType: string
  }
  position: { x: number; y: number }
  style: {
    background: string
    border: string
    borderRadius: string
    padding: string
    color: string
    fontSize: string
    fontWeight: string
  }
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  animated: boolean
  style: {
    stroke: string
    strokeWidth: number
  }
}

/**
 * Get color for span status
 */
function getStatusColor(status: string): { bg: string; border: string; text: string } {
  switch (status) {
    case WORKFLOW_STATUS.COMPLETED:
      return { bg: '#dcfce7', border: '#16a34a', text: '#15803d' } // green
    case WORKFLOW_STATUS.FAILED:
      return { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' } // red
    case WORKFLOW_STATUS.RUNNING:
      return { bg: '#dbeafe', border: '#2563eb', text: '#1e40af' } // blue
    default:
      return { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' } // gray
  }
}

/**
 * Format duration in milliseconds to readable string
 */
function formatDuration(ms: number | null): string {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60000).toFixed(2)}m`
}

/**
 * Build React Flow compatible node and edge data from trace spans
 */
export function buildTraceGraph(
  spans: TraceSpan[],
  selectedSpanId?: string
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  if (!spans || spans.length === 0) {
    return { nodes: [], edges: [] }
  }

  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []

  // Map for finding root spans
  const spanMap = new Map<string, TraceSpan>()
  const childrenMap = new Map<string, TraceSpan[]>()

  spans.forEach(span => {
    spanMap.set(span.span_id, span)
    if (span.parent_span_id) {
      if (!childrenMap.has(span.parent_span_id)) {
        childrenMap.set(span.parent_span_id, [])
      }
      childrenMap.get(span.parent_span_id)!.push(span)
    }
  })

  const rootSpans = spans.filter(s => !s.parent_span_id)
  const xSpacing = 250
  const ySpacing = 100

  function layoutSubtree(span: TraceSpan, x: number, y: number): number {
    const color = getStatusColor(span.status)
    const isSelected = selectedSpanId === span.span_id

    nodes.push({
      id: span.span_id,
      data: {
        label: `${span.entity_type} ${span.entity_id.slice(0, 8)}`,
        status: span.status,
        duration: formatDuration(span.duration_ms),
        entityType: span.entity_type,
      },
      position: { x, y },
      style: {
        background: color.bg,
        border: `2px solid ${isSelected ? '#3b82f6' : color.border}`,
        borderRadius: '8px',
        padding: '10px 15px',
        color: color.text,
        fontSize: '12px',
        fontWeight: isSelected ? '600' : '500',
      },
    })

    const children = childrenMap.get(span.span_id) || []
    let nextY = y + ySpacing
    const childWidth = xSpacing / Math.max(children.length, 1)

    children.forEach((child, index) => {
      const childX = x - (xSpacing / 2) + (index + 0.5) * childWidth
      edges.push({
        id: `${span.span_id}-${child.span_id}`,
        source: span.span_id,
        target: child.span_id,
        animated: child.status === WORKFLOW_STATUS.RUNNING,
        style: {
          stroke: color.border,
          strokeWidth: 2,
        },
      })

      nextY = Math.max(nextY, layoutSubtree(child, childX, nextY) + ySpacing)
    })

    return nextY
  }

  let currentY = 50
  const rootWidth = xSpacing / Math.max(rootSpans.length, 1)

  rootSpans.forEach((root, index) => {
    const rootX = 50 + (index + 0.5) * rootWidth
    currentY = Math.max(currentY, layoutSubtree(root, rootX, currentY))
  })

  return { nodes, edges }
}

/**
 * Find a specific span and its related spans
 */
export function highlightSpanPath(
  spans: TraceSpan[],
  targetSpanId: string
): { highlighted: Set<string>; error?: string } {
  const spanMap = new Map<string, TraceSpan>()
  spans.forEach(s => spanMap.set(s.span_id, s))

  const targetSpan = spanMap.get(targetSpanId)
  if (!targetSpan) {
    return { highlighted: new Set(), error: 'Span not found' }
  }

  const highlighted = new Set<string>()
  highlighted.add(targetSpan.span_id)

  let current = targetSpan
  while (current.parent_span_id) {
    highlighted.add(current.parent_span_id)
    current = spanMap.get(current.parent_span_id)!
    if (!current) break
  }

  function addChildren(spanId: string) {
    spans.forEach(s => {
      if (s.parent_span_id === spanId) {
        highlighted.add(s.span_id)
        addChildren(s.span_id)
      }
    })
  }
  addChildren(targetSpanId)

  return { highlighted }
}
