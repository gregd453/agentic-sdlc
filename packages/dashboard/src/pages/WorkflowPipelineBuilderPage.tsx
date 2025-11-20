import { useNavigate } from 'react-router-dom'
import { createWorkflow } from '../api/client'
import WorkflowPipelineBuilder from '../components/Workflows/WorkflowPipelineBuilder'
import { WorkflowStage } from '../components/Workflows/workflowTemplates'

export default function WorkflowPipelineBuilderPage() {
  const navigate = useNavigate()

  const handleWorkflowCreated = async (stages: WorkflowStage[]) => {
    try {
      // Create workflow with multi-stage configuration using API client
      const workflow = await createWorkflow({
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

      // Navigate to the created workflow
      navigate(`/workflows/${workflow.id}`)
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
