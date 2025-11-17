import { TraceRepository, TraceHierarchy, TraceSpan } from '../repositories/trace.repository';
import { WorkflowRepository } from '../repositories/workflow.repository';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';

export interface TraceTreeNode {
  span: TraceSpan;
  children: TraceTreeNode[];
}

export interface TraceDetails {
  trace_id: string;
  metadata: {
    total_duration_ms: number | null;
    span_count: number;
    error_count: number;
    workflow_count: number;
    task_count: number;
    start_time: Date | null;
    end_time: Date | null;
  };
  hierarchy: TraceHierarchy;
  tree: TraceTreeNode[];
}

export class TraceService {
  constructor(
    private traceRepository: TraceRepository,
    private workflowRepository: WorkflowRepository
  ) {}

  /**
   * Get complete trace details including metadata, hierarchy, and tree structure
   */
  async getTraceById(traceId: string): Promise<TraceDetails> {
    try {
      logger.debug('Getting trace by ID', { trace_id: traceId });

      // Check if trace exists
      const exists = await this.traceRepository.traceExists(traceId);
      if (!exists) {
        throw new NotFoundError(`Trace not found: ${traceId}`);
      }

      // Get trace metadata and hierarchy
      const [metadata, hierarchy] = await Promise.all([
        this.traceRepository.getTraceMetadata(traceId),
        this.traceRepository.getSpanHierarchy(traceId)
      ]);

      // Build tree structure from spans
      const tree = this.buildTree(hierarchy.spans);

      logger.debug('Trace retrieved successfully', {
        trace_id: traceId,
        span_count: hierarchy.spans.length,
        workflow_count: hierarchy.workflows.length,
        task_count: hierarchy.tasks.length
      });

      return {
        trace_id: traceId,
        metadata,
        hierarchy,
        tree
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to get trace by ID', { trace_id: traceId, error });
      throw error;
    }
  }

  /**
   * Get just the span hierarchy for a trace
   */
  async getSpans(traceId: string): Promise<TraceSpan[]> {
    try {
      logger.debug('Getting spans for trace', { trace_id: traceId });

      const exists = await this.traceRepository.traceExists(traceId);
      if (!exists) {
        throw new NotFoundError(`Trace not found: ${traceId}`);
      }

      const hierarchy = await this.traceRepository.getSpanHierarchy(traceId);

      return hierarchy.spans;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to get spans', { trace_id: traceId, error });
      throw error;
    }
  }

  /**
   * Get workflows associated with a trace
   */
  async getRelatedWorkflows(traceId: string) {
    try {
      logger.debug('Getting workflows for trace', { trace_id: traceId });

      const workflows = await this.traceRepository.findWorkflowsByTraceId(traceId);

      if (workflows.length === 0) {
        logger.warn('No workflows found for trace', { trace_id: traceId });
      }

      return workflows;
    } catch (error) {
      logger.error('Failed to get related workflows', { trace_id: traceId, error });
      throw error;
    }
  }

  /**
   * Get tasks associated with a trace
   */
  async getRelatedTasks(traceId: string) {
    try {
      logger.debug('Getting tasks for trace', { trace_id: traceId });

      const tasks = await this.traceRepository.findTasksByTraceId(traceId);

      return tasks;
    } catch (error) {
      logger.error('Failed to get related tasks', { trace_id: traceId, error });
      throw error;
    }
  }

  /**
   * Build a tree structure from flat span list
   * Handles parent-child relationships via parent_span_id
   */
  private buildTree(spans: TraceSpan[]): TraceTreeNode[] {
    if (spans.length === 0) {
      return [];
    }

    // Create a map for quick lookup
    const spanMap = new Map<string, TraceTreeNode>();
    const roots: TraceTreeNode[] = [];

    // Initialize all nodes
    spans.forEach(span => {
      spanMap.set(span.span_id, {
        span,
        children: []
      });
    });

    // Build parent-child relationships
    spans.forEach(span => {
      const node = spanMap.get(span.span_id)!;

      if (span.parent_span_id) {
        const parent = spanMap.get(span.parent_span_id);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found, treat as root (handle orphaned spans)
          logger.warn('Orphaned span detected', {
            span_id: span.span_id,
            parent_span_id: span.parent_span_id
          });
          roots.push(node);
        }
      } else {
        // No parent, this is a root
        roots.push(node);
      }
    });

    // Sort children by created_at
    const sortChildren = (node: TraceTreeNode) => {
      node.children.sort((a, b) =>
        a.span.created_at.getTime() - b.span.created_at.getTime()
      );
      node.children.forEach(sortChildren);
    };

    roots.forEach(sortChildren);

    // Sort roots by created_at
    roots.sort((a, b) =>
      a.span.created_at.getTime() - b.span.created_at.getTime()
    );

    return roots;
  }

  /**
   * Validate trace ID format (basic validation)
   */
  validateTraceId(traceId: string): boolean {
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(traceId);
  }

  /**
   * Get trace summary (lightweight version without full details)
   */
  async getTraceSummary(traceId: string): Promise<{
    trace_id: string;
    workflow_count: number;
    task_count: number;
    error_count: number;
    total_duration_ms: number | null;
  }> {
    try {
      const metadata = await this.traceRepository.getTraceMetadata(traceId);

      return {
        trace_id: metadata.trace_id,
        workflow_count: metadata.workflow_count,
        task_count: metadata.task_count,
        error_count: metadata.error_count,
        total_duration_ms: metadata.total_duration_ms
      };
    } catch (error) {
      logger.error('Failed to get trace summary', { trace_id: traceId, error });
      throw error;
    }
  }

  /**
   * List traces with pagination and filtering
   */
  async listTraces(options: {
    limit?: number;
    offset?: number;
    status?: string;
  } = {}): Promise<{
    traces: Array<{
      trace_id: string;
      status: string;
      workflow_count: number;
      task_count: number;
      span_count: number;
      total_duration_ms: number | null;
      started_at: Date | null;
      completed_at: Date | null;
    }>;
    total: number;
  }> {
    try {
      logger.debug('Listing traces', { limit: options.limit, offset: options.offset, status: options.status });
      const result = await this.traceRepository.listTraces(options);
      logger.debug('Traces listed', { count: result.traces.length, total: result.total });
      return result;
    } catch (error) {
      logger.error('Failed to list traces', { error });
      throw error;
    }
  }
}
