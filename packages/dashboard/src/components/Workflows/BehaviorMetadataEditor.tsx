import { useState } from 'react'

interface BehaviorMetadataEditorProps {
  selectedPreset?: string // Kept for future use (e.g., showing which preset was selected)
  behaviorMetadata: any
  onMetadataChange: (metadata: any) => void
  onReset: () => void
}

// Mode-specific default templates for advanced editing
const MODE_TEMPLATES = {
  success: {
    mode: 'success',
    metrics: { duration_ms: 0, memory_mb: 0, cpu_percent: 0 },
    timing: { execution_delay_ms: 0 },
    constraints: { max_retries: 0, timeout_ms: 30000 }
  },
  failure: {
    mode: 'failure',
    error: {
      code: 'CUSTOM_ERROR',
      message: 'Custom error message',
      retryable: true,
      recovery_suggestion: 'How to recover'
    },
    constraints: { max_retries: 3, timeout_ms: 30000 }
  },
  timeout: {
    mode: 'timeout',
    timing: { timeout_at_ms: 5000 },
    error: {
      code: 'TIMEOUT',
      message: 'Stage execution exceeded timeout',
      retryable: true
    },
    constraints: { max_retries: 2, timeout_ms: 10000 }
  },
  partial: {
    mode: 'partial',
    partial: {
      total_items: 10,
      successful_items: 7,
      failed_items: 3,
      failure_rate: 0.3,
      first_failure_at: 1
    },
    output: { tests_run: 10, tests_passed: 7, tests_failed: 3 },
    constraints: { max_retries: 1, timeout_ms: 30000 }
  },
  crash: {
    mode: 'crash',
    error: {
      code: 'AGENT_CRASH',
      message: 'Agent process crashed unexpectedly',
      retryable: true
    },
    timing: { crash_after_ms: 1000 },
    constraints: { max_retries: 3, timeout_ms: 30000 }
  }
}

export default function BehaviorMetadataEditor({
  behaviorMetadata,
  onMetadataChange,
  onReset
}: BehaviorMetadataEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    mode: true,
    error: false,
    timing: false,
    metrics: false,
    partial: false,
    output: false,
    constraints: false
  })

  const [jsonMode, setJsonMode] = useState(false)
  const [jsonText, setJsonText] = useState(JSON.stringify(behaviorMetadata, null, 2))

  // Get the current mode from behavior metadata
  const currentMode = behaviorMetadata?.mode || 'success'

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Update metadata value
  const updateMetadata = (path: string, value: any) => {
    const parts = path.split('.')
    const newMetadata = JSON.parse(JSON.stringify(behaviorMetadata))

    let current = newMetadata
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {}
      }
      current = current[parts[i]]
    }

    current[parts[parts.length - 1]] = value

    onMetadataChange(newMetadata)
    setJsonText(JSON.stringify(newMetadata, null, 2))
  }

  // Handle JSON mode changes
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonText(e.target.value)
    try {
      const parsed = JSON.parse(e.target.value)
      onMetadataChange(parsed)
    } catch {
      // Allow invalid JSON while editing
    }
  }

  // Reset to preset
  const handleReset = () => {
    onReset()
    setJsonText(JSON.stringify(MODE_TEMPLATES[currentMode as keyof typeof MODE_TEMPLATES] || behaviorMetadata, null, 2))
  }

  // Copy to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(jsonText)
  }

  return (
    <div className="space-y-4 border-t border-gray-200 pt-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-gray-900">Advanced Behavior Configuration</h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setJsonMode(!jsonMode)}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            title={jsonMode ? 'Switch to form mode' : 'Switch to JSON mode'}
          >
            {jsonMode ? 'Form' : 'JSON'}
          </button>
          <button
            type="button"
            onClick={copyToClipboard}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            title="Copy to clipboard"
          >
            📋
          </button>
        </div>
      </div>

      {jsonMode ? (
        // JSON Editor Mode
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">JSON Configuration</label>
          <textarea
            value={jsonText}
            onChange={handleJsonChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            rows={12}
          />
          <p className="text-xs text-gray-500">Edit JSON directly or use the form mode below</p>
        </div>
      ) : (
        // Form Mode with Conditional Fields
        <div className="space-y-3">
          {/* Mode Indicator */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm">
              <span className="font-medium text-gray-900">Current Mode: </span>
              <span className="text-blue-700 font-mono">{currentMode}</span>
            </p>
          </div>

          {/* Success Mode Fields */}
          {currentMode === 'success' && (
            <>
              {/* Timing Section */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('timing')}
                  className="w-full px-4 py-3 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-gray-900">Execution Timing</span>
                  <span className="text-lg">{expandedSections.timing ? '▲' : '▼'}</span>
                </button>
                {expandedSections.timing && (
                  <div className="p-4 space-y-4 border-t border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Execution Delay (ms)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="60000"
                        step="100"
                        value={behaviorMetadata?.timing?.execution_delay_ms || 0}
                        onChange={(e) => updateMetadata('timing.execution_delay_ms', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Simulate slower execution (0-60000ms)</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Metrics Section */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('metrics')}
                  className="w-full px-4 py-3 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <span className="font-medium text-gray-900">Performance Metrics</span>
                  {expandedSections.metrics ? "▲" : "▼"}
                </button>
                {expandedSections.metrics && (
                  <div className="p-4 space-y-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Duration (ms)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={behaviorMetadata?.metrics?.duration_ms || 0}
                          onChange={(e) => updateMetadata('metrics.duration_ms', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Memory (MB)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={behaviorMetadata?.metrics?.memory_mb || 0}
                          onChange={(e) => updateMetadata('metrics.memory_mb', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          CPU (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="5"
                          value={behaviorMetadata?.metrics?.cpu_percent || 0}
                          onChange={(e) => updateMetadata('metrics.cpu_percent', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Failure Mode Fields */}
          {currentMode === 'failure' && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('error')}
                className="w-full px-4 py-3 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-900">Error Configuration</span>
                {expandedSections.error ? "▲" : "▼"}
              </button>
              {expandedSections.error && (
                <div className="p-4 space-y-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Error Code</label>
                    <select
                      value={behaviorMetadata?.error?.code || 'VALIDATION_ERROR'}
                      onChange={(e) => updateMetadata('error.code', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="VALIDATION_ERROR">Validation Error</option>
                      <option value="DEPLOYMENT_FAILED">Deployment Failed</option>
                      <option value="FATAL_ERROR">Fatal Error</option>
                      <option value="CUSTOM_ERROR">Custom Error</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Error Message</label>
                    <textarea
                      value={behaviorMetadata?.error?.message || ''}
                      onChange={(e) => updateMetadata('error.message', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                      placeholder="Describe what went wrong"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Recovery Suggestion</label>
                    <textarea
                      value={behaviorMetadata?.error?.recovery_suggestion || ''}
                      onChange={(e) => updateMetadata('error.recovery_suggestion', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      rows={2}
                      placeholder="How to fix this error"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="retryable"
                      checked={behaviorMetadata?.error?.retryable !== false}
                      onChange={(e) => updateMetadata('error.retryable', e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="retryable" className="ml-2 text-sm font-medium text-gray-700">
                      Error is retryable
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeout Mode Fields */}
          {currentMode === 'timeout' && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('timing')}
                className="w-full px-4 py-3 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-900">Timeout Configuration</span>
                {expandedSections.timing ? "▲" : "▼"}
              </button>
              {expandedSections.timing && (
                <div className="p-4 space-y-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Timeout After (ms)
                    </label>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      value={behaviorMetadata?.timing?.timeout_at_ms || 5000}
                      onChange={(e) => updateMetadata('timing.timeout_at_ms', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">When should the timeout occur</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Partial Success Fields */}
          {currentMode === 'partial' && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('partial')}
                className="w-full px-4 py-3 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-900">Partial Success Configuration</span>
                {expandedSections.partial ? "▲" : "▼"}
              </button>
              {expandedSections.partial && (
                <div className="p-4 space-y-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Items</label>
                      <input
                        type="number"
                        min="1"
                        value={behaviorMetadata?.partial?.total_items || 10}
                        onChange={(e) => updateMetadata('partial.total_items', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Successful Items</label>
                      <input
                        type="number"
                        min="0"
                        value={behaviorMetadata?.partial?.successful_items || 7}
                        onChange={(e) => updateMetadata('partial.successful_items', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Failed Items</label>
                      <input
                        type="number"
                        min="0"
                        value={behaviorMetadata?.partial?.failed_items || 3}
                        onChange={(e) => updateMetadata('partial.failed_items', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Failure At</label>
                      <input
                        type="number"
                        min="0"
                        value={behaviorMetadata?.partial?.first_failure_at || 1}
                        onChange={(e) => updateMetadata('partial.first_failure_at', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Crash Mode Fields */}
          {currentMode === 'crash' && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSection('timing')}
                className="w-full px-4 py-3 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-900">Crash Configuration</span>
                {expandedSections.timing ? "▲" : "▼"}
              </button>
              {expandedSections.timing && (
                <div className="p-4 space-y-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Crash After (ms)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={behaviorMetadata?.timing?.crash_after_ms || 1000}
                      onChange={(e) => updateMetadata('timing.crash_after_ms', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">When should the agent crash</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Global Constraints */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('constraints')}
              className="w-full px-4 py-3 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <span className="font-medium text-gray-900">Execution Constraints</span>
              {expandedSections.constraints ? "▲" : "▼"}
            </button>
            {expandedSections.constraints && (
              <div className="p-4 space-y-4 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Retries</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={behaviorMetadata?.constraints?.max_retries || 0}
                      onChange={(e) => updateMetadata('constraints.max_retries', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Timeout (ms)
                    </label>
                    <input
                      type="number"
                      min="1000"
                      step="1000"
                      value={behaviorMetadata?.constraints?.timeout_ms || 30000}
                      onChange={(e) => updateMetadata('constraints.timeout_ms', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            ↻ Reset to Preset Defaults
          </button>
        </div>
      )}
    </div>
  )
}
