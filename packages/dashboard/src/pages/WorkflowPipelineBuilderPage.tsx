import { useNavigate } from 'react-router-dom'
import WorkflowPipelineBuilder from '../components/Workflows/WorkflowPipelineBuilder'
import { WorkflowStage } from '../components/Workflows/workflowTemplates'

export default function WorkflowPipelineBuilderPage() {
  const navigate = useNavigate()

  const handleWorkflowCreated = async (stages: WorkflowStage[]) => {
    try {
      // Create workflow with multi-stage configuration
      const response = await fetch('http://localhost:3051/api/v1/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Multi-Stage Workflow',
          description: 'Created using Phase 3 Pipeline Builder',
          type: 'app',
          priority: 'medium',
          stages: stages.map(stage => ({
            order: stage.order,
            name: stage.name,
            agentType: stage.agentType,
            behaviorMetadata: stage.behaviorMetadata,
            constraints: stage.constraints,
            description: stage.description
          }))
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create workflow: ${response.statusText}`)
      }

      const result = await response.json()
      const workflowId = result.id || result.workflow_id

      // Navigate to the created workflow
      navigate(`/workflows/${workflowId}`)
    } catch (error) {
      console.error('Failed to create workflow:', error)
      alert(`Error creating workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Multi-Stage Workflow Builder</h1>
        <p className="text-gray-600 mt-2">
          Design complex workflows with multiple stages, drag-drop reordering, and custom behavior configuration
        </p>
      </div>

      <WorkflowPipelineBuilder onWorkflowCreated={handleWorkflowCreated} />
    </div>
  )
}
