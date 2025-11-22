/**
 * Scheduler Jobs Page
 *
 * Main page for managing scheduled jobs
 * Session #89: Phase 1 - Jobs Management
 */

import React, { useState, useEffect } from 'react';
import { Plus, Search, Play, Pause, Edit, Trash2, MoreVertical, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { schedulerApi, Job, JobStatus, JobType } from '../api/scheduler';
import { PageContainer } from '../components/Layout/PageContainer';
import { MetricCard } from '../components/Common/MetricCard';

export const SchedulerJobsPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<JobType | 'all'>('all');

  // Load jobs
  useEffect(() => {
    loadJobs();
  }, [statusFilter, typeFilter]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (typeFilter !== 'all') filters.type = typeFilter;

      const data = await schedulerApi.listJobs(filters);
      setJobs(data);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter jobs by search query
  const filteredJobs = jobs.filter(job =>
    job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.handler_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const stats = {
    active: jobs.filter(j => j.status === 'active').length,
    paused: jobs.filter(j => j.status === 'paused').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    completed: jobs.filter(j => j.status === 'completed').length,
  };

  const handlePauseResume = async (job: Job) => {
    try {
      if (job.status === 'active') {
        await schedulerApi.pauseJob(job.id);
      } else if (job.status === 'paused') {
        await schedulerApi.resumeJob(job.id);
      }
      await loadJobs();
    } catch (error) {
      console.error('Failed to pause/resume job:', error);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    try {
      await schedulerApi.deleteJob(jobId);
      await loadJobs();
    } catch (error) {
      console.error('Failed to delete job:', error);
    }
  };

  return (
    <PageContainer
      title="Scheduler"
      description="Manage scheduled jobs and executions"
      actions={
        <button
          onClick={() => {/* TODO: Add modal */}}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Job
        </button>
      }
    >

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Types</option>
            <option value="cron">Cron</option>
            <option value="one_time">One-Time</option>
            <option value="recurring">Recurring</option>
            <option value="event">Event</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          {/* Reset */}
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setTypeFilter('all');
            }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Active"
          value={stats.active}
          icon={Clock}
        />
        <MetricCard
          title="Paused"
          value={stats.paused}
          icon={Pause}
        />
        <MetricCard
          title="Failed"
          value={stats.failed}
          icon={AlertCircle}
        />
        <MetricCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle2}
        />
      </div>

      {/* Jobs List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Jobs ({filteredJobs.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Loading jobs...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No jobs found
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onPauseResume={() => handlePauseResume(job)}
                onDelete={() => handleDelete(job.id)}
              />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

// ==========================================
// JOB CARD COMPONENT
// ==========================================

interface JobCardProps {
  job: Job;
  onPauseResume: () => void;
  onDelete: () => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, onPauseResume, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<JobStatus, string> = {
    active: 'text-green-600 bg-green-100 dark:bg-green-900/20',
    paused: 'text-amber-600 bg-amber-100 dark:bg-amber-900/20',
    completed: 'text-gray-600 bg-gray-100 dark:bg-gray-700',
    failed: 'text-red-600 bg-red-100 dark:bg-red-900/20',
    cancelled: 'text-gray-600 bg-gray-100 dark:bg-gray-700',
    pending: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20',
  };

  const successRate = job.executions_count > 0
    ? Math.round((job.success_count / job.executions_count) * 100)
    : 0;

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {job.name}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
              {job.status}
            </span>
          </div>

          {/* Schedule Info */}
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {job.type === 'cron' && job.schedule && (
              <div>Every: {job.schedule} ({job.timezone || 'UTC'})</div>
            )}
            {job.type === 'one_time' && (
              <div>Execute once at: {formatTime(job.next_run)}</div>
            )}
            <div className="flex gap-4 mt-1">
              <span>Next run: {formatTime(job.next_run)}</span>
              <span>Last run: {formatTime(job.last_run)}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 text-sm mb-3">
            <span className="text-green-600 dark:text-green-400">
              ✓ {job.success_count}/{job.executions_count}
            </span>
            {job.failure_count > 0 && (
              <span className="text-red-600 dark:text-red-400">
                ⚠ {job.failure_count} failed
              </span>
            )}
            <span className="text-gray-600 dark:text-gray-400">
              ⌛ {formatDuration(job.avg_duration_ms)} avg
            </span>
            {job.executions_count > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                {successRate}% success
              </span>
            )}
          </div>

          {/* Tags */}
          {job.tags && job.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {job.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onPauseResume}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title={job.status === 'active' ? 'Pause' : 'Resume'}
          >
            {job.status === 'active' ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </button>
          <button
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title="More"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Handler:</span>
              <span className="ml-2 font-mono text-gray-900 dark:text-white">
                {job.handler_name}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Type:</span>
              <span className="ml-2 text-gray-900 dark:text-white">{job.handler_type}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Timeout:</span>
              <span className="ml-2 text-gray-900 dark:text-white">
                {(job.timeout_ms / 1000).toFixed(0)}s
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Max Retries:</span>
              <span className="ml-2 text-gray-900 dark:text-white">{job.max_retries}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Priority:</span>
              <span className="ml-2 text-gray-900 dark:text-white">{job.priority}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Platform:</span>
              <span className="ml-2 text-gray-900 dark:text-white">
                {job.platform_id || 'Global'}
              </span>
            </div>
          </div>

          {job.description && (
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-sm">Description:</span>
              <p className="mt-1 text-gray-900 dark:text-white">{job.description}</p>
            </div>
          )}

          {job.payload && (
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-sm">Payload:</span>
              <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto">
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
