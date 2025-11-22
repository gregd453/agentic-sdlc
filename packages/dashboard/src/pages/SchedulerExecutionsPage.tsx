/**
 * Scheduler Executions Page
 *
 * View execution history and details
 * Session #89: Phase 2 - Executions History
 */

import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { schedulerApi, JobExecution, ExecutionStatus, Job } from '../api/scheduler';
import { PageContainer } from '../components/Layout/PageContainer';
import { MetricCard } from '../components/Common/MetricCard';

export const SchedulerExecutionsPage: React.FC = () => {
  const [executions, setExecutions] = useState<JobExecution[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all');
  const [selectedExecution, setSelectedExecution] = useState<JobExecution | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load all jobs first to get execution history
      const jobsData = await schedulerApi.listJobs();
      setJobs(jobsData);

      // Load recent executions from all jobs
      const allExecutions: JobExecution[] = [];
      for (const job of jobsData.slice(0, 20)) { // Limit to first 20 jobs for performance
        try {
          const history = await schedulerApi.getJobHistory(job.id, { limit: 10 });
          allExecutions.push(...history);
        } catch (error) {
          console.error(`Failed to load history for job ${job.id}:`, error);
        }
      }

      // Sort by started_at descending
      allExecutions.sort((a, b) => {
        const dateA = new Date(a.started_at || a.scheduled_at).getTime();
        const dateB = new Date(b.started_at || b.scheduled_at).getTime();
        return dateB - dateA;
      });

      setExecutions(allExecutions);
    } catch (error) {
      console.error('Failed to load executions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter executions
  const filteredExecutions = executions.filter(exec => {
    const job = jobs.find(j => j.id === exec.job_id);
    const matchesSearch = job?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || exec.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: executions.length,
    success: executions.filter(e => e.status === 'success').length,
    failed: executions.filter(e => e.status === 'failed').length,
    running: executions.filter(e => e.status === 'running').length,
  };

  const successRate = stats.total > 0
    ? ((stats.success / stats.total) * 100).toFixed(1)
    : '0.0';

  const handleRetry = async (executionId: string) => {
    try {
      await schedulerApi.retryExecution(executionId);
      await loadData();
    } catch (error) {
      console.error('Failed to retry execution:', error);
    }
  };

  return (
    <PageContainer
      title="Executions"
      description="View job execution history and details"
    >

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by job name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="timeout">Timeout</option>
          </select>

          {/* Reset */}
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Total"
          value={stats.total}
          icon={AlertCircle}
        />
        <MetricCard
          title="Success"
          value={`${stats.success} (${successRate}%)`}
          icon={CheckCircle}
        />
        <MetricCard
          title="Failed"
          value={stats.failed}
          icon={XCircle}
        />
        <MetricCard
          title="Running"
          value={stats.running}
          icon={Loader2}
        />
      </div>

      {/* Success Rate Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Success Rate
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {successRate}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${successRate}%` }}
          />
        </div>
      </div>

      {/* Executions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Executions ({filteredExecutions.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Loading executions...
          </div>
        ) : filteredExecutions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No executions found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Job Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Started
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredExecutions.map((execution) => {
                  const job = jobs.find(j => j.id === execution.job_id);
                  return (
                    <ExecutionRow
                      key={execution.id}
                      execution={execution}
                      jobName={job?.name || 'Unknown'}
                      onView={() => setSelectedExecution(execution)}
                      onRetry={() => handleRetry(execution.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Execution Detail Modal */}
      {selectedExecution && (
        <ExecutionDetailModal
          execution={selectedExecution}
          jobName={jobs.find(j => j.id === selectedExecution.job_id)?.name || 'Unknown'}
          onClose={() => setSelectedExecution(null)}
          onRetry={() => {
            handleRetry(selectedExecution.id);
            setSelectedExecution(null);
          }}
        />
      )}
    </PageContainer>
  );
};

// ==========================================
// EXECUTION ROW COMPONENT
// ==========================================

interface ExecutionRowProps {
  execution: JobExecution;
  jobName: string;
  onView: () => void;
  onRetry: () => void;
}

const ExecutionRow: React.FC<ExecutionRowProps> = ({ execution, jobName, onView, onRetry }) => {
  const statusIcons: Record<ExecutionStatus, React.ReactNode> = {
    success: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
    running: <Clock className="w-4 h-4 text-blue-500 animate-spin" />,
    timeout: <AlertCircle className="w-4 h-4 text-amber-500" />,
    pending: <Clock className="w-4 h-4 text-gray-400" />,
    cancelled: <XCircle className="w-4 h-4 text-gray-400" />,
    skipped: <span className="text-gray-400">⏭</span>,
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {statusIcons[execution.status]}
          <span className="text-sm text-gray-900 dark:text-white capitalize">
            {execution.status}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
        {jobName}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {formatTime(execution.started_at)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {formatDuration(execution.duration_ms)}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={onView}
            className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
          >
            View
          </button>
          {execution.status === 'failed' && (
            <button
              onClick={onRetry}
              className="px-3 py-1 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
            >
              Retry
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// ==========================================
// EXECUTION DETAIL MODAL
// ==========================================

interface ExecutionDetailModalProps {
  execution: JobExecution;
  jobName: string;
  onClose: () => void;
  onRetry: () => void;
}

const ExecutionDetailModal: React.FC<ExecutionDetailModalProps> = ({
  execution,
  jobName,
  onClose,
  onRetry,
}) => {
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Execution Details
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Banner */}
          <div className={`p-4 rounded-lg ${
            execution.status === 'success' ? 'bg-green-50 dark:bg-green-900/20' :
            execution.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20' :
            'bg-blue-50 dark:bg-blue-900/20'
          }`}>
            <div className="flex items-center gap-2">
              {execution.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {execution.status === 'failed' && <XCircle className="w-5 h-5 text-red-600" />}
              {execution.status === 'running' && <Clock className="w-5 h-5 text-blue-600" />}
              <span className="font-semibold text-gray-900 dark:text-white capitalize">
                {execution.status}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {jobName}
            </div>
          </div>

          {/* Metrics */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Execution Metrics
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Execution ID:</span>
                <div className="font-mono text-xs text-gray-900 dark:text-white mt-1">
                  {execution.id}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Job ID:</span>
                <div className="font-mono text-xs text-gray-900 dark:text-white mt-1">
                  {execution.job_id}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Scheduled At:</span>
                <div className="text-gray-900 dark:text-white mt-1">
                  {formatTime(execution.scheduled_at)}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Started At:</span>
                <div className="text-gray-900 dark:text-white mt-1">
                  {formatTime(execution.started_at)}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Completed At:</span>
                <div className="text-gray-900 dark:text-white mt-1">
                  {formatTime(execution.completed_at)}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Duration:</span>
                <div className="text-gray-900 dark:text-white mt-1">
                  {execution.duration_ms ? `${(execution.duration_ms / 1000).toFixed(1)}s` : 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Retry Count:</span>
                <div className="text-gray-900 dark:text-white mt-1">
                  {execution.retry_count} / {execution.max_retries}
                </div>
              </div>
              {execution.worker_id && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Worker ID:</span>
                  <div className="font-mono text-xs text-gray-900 dark:text-white mt-1">
                    {execution.worker_id}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Result/Error */}
          {execution.result && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Result
              </h3>
              <pre className="p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-48">
                {JSON.stringify(execution.result, null, 2)}
              </pre>
            </div>
          )}

          {execution.error && (
            <div>
              <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                Error
              </h3>
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-900 dark:text-red-100">
                {execution.error}
              </div>
              {execution.error_stack && (
                <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-32">
                  {execution.error_stack}
                </pre>
              )}
            </div>
          )}

          {/* Trace Info */}
          {execution.trace_id && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Trace Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Trace ID:</span>
                  <div className="font-mono text-xs text-gray-900 dark:text-white mt-1">
                    {execution.trace_id}
                  </div>
                </div>
                {execution.span_id && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Span ID:</span>
                    <div className="font-mono text-xs text-gray-900 dark:text-white mt-1">
                      {execution.span_id}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Close
          </button>
          {execution.status === 'failed' && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
