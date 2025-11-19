/**
 * SchemaFormBuilder - Dynamic form generator from JSON Schema
 * Session #85: Dashboard Agent Extensibility
 *
 * Supports:
 * - String inputs
 * - Number inputs
 * - Boolean checkboxes
 * - Enum/select dropdowns
 * - Text areas for long text
 */

import { useMemo } from 'react'

interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'array'
  default?: any
  description?: string
  enum?: string[]
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
}

interface ConfigSchema {
  [key: string]: SchemaField
}

interface SchemaFormBuilderProps {
  schema: ConfigSchema | null | undefined
  values: Record<string, any>
  onChange: (fieldName: string, value: any) => void
  disabled?: boolean
}

export default function SchemaFormBuilder({
  schema,
  values,
  onChange,
  disabled = false
}: SchemaFormBuilderProps) {
  // If no schema, show message
  if (!schema || Object.keys(schema).length === 0) {
    return (
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
        <p className="text-sm text-gray-600">No custom configuration available for this agent</p>
      </div>
    )
  }

  const fields = useMemo(() => {
    return Object.entries(schema).map(([name, fieldDef]) => ({
      name,
      ...fieldDef
    }))
  }, [schema])

  const renderField = (field: (SchemaField & { name: string })) => {
    const value = values[field.name] ?? field.default ?? ''
    const commonProps = {
      id: field.name,
      name: field.name,
      disabled,
      className:
        'w-full px-3 py-2 border border-gray-300 rounded-md ' +
        'focus:outline-none focus:ring-blue-500 focus:border-blue-500 ' +
        (disabled ? 'bg-gray-100 cursor-not-allowed' : '')
    }

    switch (field.type) {
      case 'boolean':
        return (
          <div key={field.name} className="flex items-center">
            <input
              {...commonProps}
              type="checkbox"
              checked={value === true}
              onChange={(e) => onChange(field.name, e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor={field.name} className="ml-2 text-sm text-gray-700">
              {field.name}
              {field.description && <p className="text-xs text-gray-500 mt-1">{field.description}</p>}
            </label>
          </div>
        )

      case 'number':
        return (
          <div key={field.name}>
            <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
              {field.name}
              {field.default !== undefined && (
                <span className="text-xs text-gray-500 ml-1">(default: {field.default})</span>
              )}
            </label>
            <input
              {...commonProps}
              type="number"
              min={field.minimum}
              max={field.maximum}
              value={value}
              onChange={(e) => onChange(field.name, parseFloat(e.target.value) || '')}
            />
            {field.description && <p className="text-xs text-gray-500 mt-1">{field.description}</p>}
          </div>
        )

      case 'string':
        // Check if it's an enum
        if (field.enum && field.enum.length > 0) {
          return (
            <div key={field.name}>
              <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
                {field.name}
                {field.default && <span className="text-xs text-gray-500 ml-1">(default: {field.default})</span>}
              </label>
              <select
                {...commonProps}
                value={value}
                onChange={(e) => onChange(field.name, e.target.value)}
              >
                <option value="">-- Select {field.name} --</option>
                {field.enum.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {field.description && <p className="text-xs text-gray-500 mt-1">{field.description}</p>}
            </div>
          )
        }

        // Long text (textarea)
        if (field.maxLength && field.maxLength > 100) {
          return (
            <div key={field.name}>
              <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
                {field.name}
                {field.default && <span className="text-xs text-gray-500 ml-1">(default: {field.default})</span>}
              </label>
              <textarea
                {...commonProps}
                value={value}
                onChange={(e) => onChange(field.name, e.target.value)}
                maxLength={field.maxLength}
                rows={3}
                className={commonProps.className + ' font-mono'}
              />
              {field.description && <p className="text-xs text-gray-500 mt-1">{field.description}</p>}
            </div>
          )
        }

        // Regular text input
        return (
          <div key={field.name}>
            <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
              {field.name}
              {field.default && <span className="text-xs text-gray-500 ml-1">(default: {field.default})</span>}
            </label>
            <input
              {...commonProps}
              type="text"
              minLength={field.minLength}
              maxLength={field.maxLength}
              value={value}
              onChange={(e) => onChange(field.name, e.target.value)}
              placeholder={field.description}
            />
            {field.description && <p className="text-xs text-gray-500 mt-1">{field.description}</p>}
          </div>
        )

      case 'array':
        // For now, just show a text area with JSON format
        return (
          <div key={field.name}>
            <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
              {field.name} (JSON array)
            </label>
            <textarea
              {...commonProps}
              value={Array.isArray(value) ? JSON.stringify(value) : value}
              onChange={(e) => {
                try {
                  onChange(field.name, JSON.parse(e.target.value))
                } catch {
                  // Keep as string if invalid JSON
                  onChange(field.name, e.target.value)
                }
              }}
              rows={3}
              className={commonProps.className + ' font-mono text-xs'}
            />
            {field.description && <p className="text-xs text-gray-500 mt-1">{field.description}</p>}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
      <h4 className="text-sm font-semibold text-gray-900">Agent Configuration</h4>
      <div className="space-y-4">
        {fields.map(field => renderField(field))}
      </div>
    </div>
  )
}
