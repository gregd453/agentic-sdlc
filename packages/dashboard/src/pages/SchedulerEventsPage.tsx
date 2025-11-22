/**
 * Scheduler Event Handlers Page
 *
 * Manage event-driven job triggers
 * Session #89: Phase 3 - Event Handlers
 */

import React, { useState } from 'react';
import { Plus, Search, ToggleLeft, ToggleRight, Edit, Trash2, Play } from 'lucide-react';
import { PageContainer } from '../components/Layout/PageContainer';
import { MetricCard } from '../components/Common/MetricCard';
import { EventHandler } from '../api/scheduler';

export const SchedulerEventsPage: React.FC = () => {
  const [handlers, setHandlers] = useState<EventHandler[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data for demo
  React.useEffect(() => {
    setTimeout(() => {
      setHandlers([
        {
          id: '1',
          event_name: 'workflow.completed',
          handler_name: 'cleanup:artifacts',
          handler_type: 'function',
          enabled: true,
          priority: 5,
          action_type: 'create_job',
          action_config: { timeout_ms: 600000 },
          platform_id: 'ml-platform',
          trigger_count: 234,
          success_count: 230,
          failure_count: 4,
          created_at: new Date().toISOString(),
          last_triggered: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: '2',
          event_name: 'task.failed',
          handler_name: 'notify:alert',
          handler_type: 'function',
          enabled: true,
          priority: 9,
          action_type: 'create_job',
          platform_id: undefined,
          trigger_count: 42,
          success_count: 42,
          failure_count: 0,
          created_at: new Date().toISOString(),
          last_triggered: new Date(Date.now() - 900000).toISOString(),
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const filteredHandlers = handlers.filter(h =>
    h.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.handler_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: handlers.length,
    enabled: handlers.filter(h => h.enabled).length,
    disabled: handlers.filter(h => !h.enabled).length,
    triggers: handlers.reduce((sum, h) => sum + h.trigger_count, 0),
  };

  const handleToggle = async (handler: EventHandler) => {
    // Toggle enabled status
    setHandlers(handlers.map(h =>
      h.id === handler.id ? { ...h, enabled: !h.enabled } : h
    ));
  };

  return (
    <PageContainer
      title="Event Handlers"
      description="Manage event-driven job triggers"
      actions={
        <button
          onClick={() => {/* TODO: Add modal */}}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Handler
        </button>
      }
    >

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search handlers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Total" value={stats.total} icon={Search} />
        <MetricCard title="Enabled" value={stats.enabled} icon={ToggleRight} />
        <MetricCard title="Disabled" value={stats.disabled} icon={ToggleLeft} />
        <MetricCard title="Total Triggers" value={stats.triggers} icon={Play} />
      </div>

      {/* Handlers List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Event Handlers ({filteredHandlers.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Loading handlers...
          </div>
        ) : filteredHandlers.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No handlers found
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredHandlers.map((handler) => (
              <EventHandlerCard
                key={handler.id}
                handler={handler}
                onToggle={() => handleToggle(handler)}
              />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

// ==========================================
// EVENT HANDLER CARD
// ==========================================

interface EventHandlerCardProps {
  handler: EventHandler;
  onToggle: () => void;
}

const EventHandlerCard: React.FC<EventHandlerCardProps> = ({ handler, onToggle }) => {
  const successRate = handler.trigger_count > 0
    ? Math.round((handler.success_count / handler.trigger_count) * 100)
    : 0;

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🎯</span>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {handler.event_name} → {handler.handler_name}
            </h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              handler.enabled
                ? 'text-green-600 bg-green-100 dark:bg-green-900/20'
                : 'text-gray-600 bg-gray-100 dark:bg-gray-700'
            }`}>
              {handler.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {/* Info */}
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-3">
            <div>When: <span className="font-medium">{handler.event_name}</span> event fires</div>
            <div>Action: {handler.action_type ? `Create Job (${handler.handler_name})` : 'Execute handler'}</div>
            <div className="flex gap-4">
              <span>Platform: {handler.platform_id || 'Global'}</span>
              <span>Priority: {handler.priority}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 text-sm">
            <span className="text-gray-700 dark:text-gray-300">
              Triggered: {handler.trigger_count} times
            </span>
            <span className="text-green-600 dark:text-green-400">
              ✓ {handler.success_count}
            </span>
            {handler.failure_count > 0 && (
              <span className="text-red-600 dark:text-red-400">
                ✗ {handler.failure_count}
              </span>
            )}
            <span className="text-blue-600 dark:text-blue-400">
              {successRate}% success
            </span>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Last: {formatTime(handler.last_triggered)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onToggle}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title={handler.enabled ? 'Disable' : 'Enable'}
          >
            {handler.enabled ? (
              <ToggleRight className="w-5 h-5 text-green-600" />
            ) : (
              <ToggleLeft className="w-5 h-5 text-gray-400" />
            )}
          </button>
          <button
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600 rounded"
            title="Test"
          >
            <Play className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
