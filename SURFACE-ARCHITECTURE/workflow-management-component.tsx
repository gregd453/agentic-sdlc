// Workflow Management Component - Execute and monitor workflows
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  Plus,
  Search,
  Filter,
  Play,
  Pause,
  Square,
  ChevronRight,
  ChevronDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Download,
  FileText,
  Eye,
  RefreshCw,
  Terminal,
  Layers,
  GitBranch,
  Bot,
  Sparkles,
  Code,
  CheckSquare,
  ArrowRight,
  MoreVertical,
  Info,
  Copy,
  Trash2
} from 'lucide-react';

interface WorkflowStage {
  name: 'Envision' | 'Plan' | 'Code' | 'Check';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  duration?: string;
  surface?: string;
  agent?: string;
  output?: string[];
}

interface Workflow {
  id: string;
  name: string;
  platform: string;
  status: 'running' | 'queued' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startTime?: string;
  duration?: string;
  eta?: string;
  stages: WorkflowStage[];
  currentStage?: string;
  surfaces: string[];
}

const workflows: Workflow[] = [
  {
    id: '#236',
    name: 'Deploy E-Commerce Updates',
    platform: 'Production',
    status: 'running',
    progress: 75,
    startTime: '12 minutes ago',
    duration: '12m',
    eta: '4m',
    currentStage: 'Code Generation',
    surfaces: ['API Surface', 'Web UI Surface', 'Admin Surface'],
    stages: [
      { name: 'Envision', status: 'completed', progress: 100, duration: '3m' },
      { name: 'Plan', status: 'completed', progress: 100, duration: '5m' },
      { name: 'Code', status: 'running', progress: 60, surface: 'API Surface', agent: 'API Generator v2.1' },
      { name: 'Check', status: 'pending', progress: 0 }
    ]
  },
  {
    id: '#235',
    name: 'Generate Mobile App Screens',
    platform: 'Development',
    status: 'running',
    progress: 45,
    startTime: '8 minutes ago',
    duration: '8m',
    eta: '10m',
    currentStage: 'Planning phase',
    surfaces: ['Mobile Surface', 'API Surface'],
    stages: [
      { name: 'Envision', status: 'completed', progress: 100, duration: '2m' },
      { name: 'Plan', status: 'running', progress: 60, agent: 'UI Planner v1.5' },
      { name: 'Code', status: 'pending', progress: 0 },
      { name: 'Check', status: 'pending', progress: 0 }
    ]
  },
  {
    id: '#234',
    name: 'Database Update',
    platform: 'Staging',
    status: 'completed',
    progress: 100,
    startTime: '2 hours ago',
    duration: '25m',
    surfaces: ['Database Surface'],
    stages: [
      { name: 'Envision', status: 'completed', progress: 100, duration: '5m' },
      { name: 'Plan', status: 'completed', progress: 100, duration: '8m' },
      { name: 'Code', status: 'completed', progress: 100, duration: '10m' },
      { name: 'Check', status: 'completed', progress: 100, duration: '2m' }
    ]
  }
];

const getStageIcon = (stage: string) => {
  switch (stage) {
    case 'Envision':
      return <Sparkles className="w-4 h-4" />;
    case 'Plan':
      return <FileText className="w-4 h-4" />;
    case 'Code':
      return <Code className="w-4 h-4" />;
    case 'Check':
      return <CheckSquare className="w-4 h-4" />;
    default:
      return <Activity className="w-4 h-4" />;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-gray-400" />;
    default:
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  }
};

export const WorkflowManagement: React.FC = () => {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(workflows[0]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>('Code');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Workflow Management</h1>
            <p className="text-gray-600 mt-1">
              Execute and monitor platform workflows
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Templates
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Workflow
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Workflow</DialogTitle>
                  <DialogDescription>
                    Configure and execute a new workflow for your platform
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div>
                    <Label htmlFor="workflow-name">Workflow Name</Label>
                    <Input
                      id="workflow-name"
                      placeholder="e.g., Deploy API Updates"
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Platform</Label>
                      <Select defaultValue="production">
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="production">Production</SelectItem>
                          <SelectItem value="staging">Staging</SelectItem>
                          <SelectItem value="development">Development</SelectItem>
                          <SelectItem value="qa">QA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Template</Label>
                      <Select defaultValue="custom">
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom</SelectItem>
                          <SelectItem value="full-deploy">Full Deployment</SelectItem>
                          <SelectItem value="api-update">API Update</SelectItem>
                          <SelectItem value="ui-refresh">UI Refresh</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Surfaces to Include</Label>
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                      {['API Surface', 'Web UI Surface', 'Admin Surface', 'Mobile Surface', 'Database Surface', 'Auth Surface'].map((surface) => (
                        <div key={surface} className="flex items-center space-x-2">
                          <Checkbox id={surface} defaultChecked={surface.includes('API') || surface.includes('Web')} />
                          <Label htmlFor={surface} className="font-normal cursor-pointer">
                            {surface}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Execution Policy</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="parallel" defaultChecked />
                        <Label htmlFor="parallel" className="font-normal cursor-pointer">
                          Enable parallel execution where possible
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="rollback" />
                        <Label htmlFor="rollback" className="font-normal cursor-pointer">
                          Auto-rollback on failure
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="notifications" defaultChecked />
                        <Label htmlFor="notifications" className="font-normal cursor-pointer">
                          Send completion notifications
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setShowCreateDialog(false)}>
                    Execute Workflow
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search workflows..."
              className="pl-10"
            />
          </div>

          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="all">
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="qa">QA</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Workflow List */}
          <div className="col-span-5">
            <Card className="h-[calc(100vh-240px)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Active Workflows</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="running" className="w-full">
                  <TabsList className="w-full rounded-none border-b">
                    <TabsTrigger value="running" className="flex-1">
                      Running (2)
                    </TabsTrigger>
                    <TabsTrigger value="queued" className="flex-1">
                      Queued (5)
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="flex-1">
                      Completed (12)
                    </TabsTrigger>
                  </TabsList>

                  <ScrollArea className="h-[calc(100vh-380px)]">
                    <TabsContent value="running" className="m-0 p-4 space-y-3">
                      {workflows.filter(w => w.status === 'running').map((workflow) => (
                        <div
                          key={workflow.id}
                          onClick={() => setSelectedWorkflow(workflow)}
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            selectedWorkflow?.id === workflow.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium text-sm">{workflow.id} {workflow.name}</p>
                              <p className="text-xs text-gray-600">Platform: {workflow.platform}</p>
                            </div>
                            <Badge variant="default" className="text-xs">
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Running
                            </Badge>
                          </div>
                          <Progress value={workflow.progress} className="h-1.5 mb-2" />
                          <div className="flex justify-between items-center text-xs text-gray-500">
                            <span>{workflow.currentStage}</span>
                            <span>ETA: {workflow.eta}</span>
                          </div>
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="queued" className="m-0 p-4 space-y-3">
                      {['#237 API Migration', '#238 UI Refresh', '#239 Security Audit', '#240 Database Update', '#241 Performance Optimization'].map((name, index) => (
                        <div key={index} className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-sm">{name}</p>
                              <p className="text-xs text-gray-600">Platform: {index % 2 === 0 ? 'Production' : 'Staging'}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              Queued
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="completed" className="m-0 p-4 space-y-3">
                      {workflows.filter(w => w.status === 'completed').map((workflow) => (
                        <div
                          key={workflow.id}
                          onClick={() => setSelectedWorkflow(workflow)}
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            selectedWorkflow?.id === workflow.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{workflow.id} {workflow.name}</p>
                              <p className="text-xs text-gray-600">
                                Platform: {workflow.platform} • Duration: {workflow.duration}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs text-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Completed
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </TabsContent>
                  </ScrollArea>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Workflow Details */}
          <div className="col-span-7">
            {selectedWorkflow ? (
              <Card className="h-[calc(100vh-240px)]">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {selectedWorkflow.id} - {selectedWorkflow.name}
                      </CardTitle>
                      <CardDescription>
                        Status: {selectedWorkflow.status === 'running' ? '⚡ Running' : '✓ Completed'} •
                        Platform: {selectedWorkflow.platform} •
                        Duration: {selectedWorkflow.duration}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {selectedWorkflow.status === 'running' && (
                        <>
                          <Button variant="outline" size="sm">
                            <Pause className="w-4 h-4 mr-1" />
                            Pause
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600">
                            <Square className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                      <Button variant="outline" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress Timeline */}
                  <div>
                    <h3 className="text-sm font-medium mb-3">Progress Timeline</h3>
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        {selectedWorkflow.stages.map((stage, index) => (
                          <div key={stage.name} className="flex-1">
                            <div className="relative">
                              {index < selectedWorkflow.stages.length - 1 && (
                                <div
                                  className={`absolute top-4 left-8 right-0 h-0.5 ${
                                    stage.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                                  }`}
                                />
                              )}
                              <div className="flex flex-col items-center">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    stage.status === 'completed'
                                      ? 'bg-green-500 text-white'
                                      : stage.status === 'running'
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-gray-200 text-gray-500'
                                  }`}
                                >
                                  {getStageIcon(stage.name)}
                                </div>
                                <span className="text-xs mt-2">{stage.name}</span>
                                <span className="text-xs text-gray-500">
                                  {stage.status === 'completed' ? stage.duration :
                                   stage.status === 'running' ? 'Running' : 'Pending'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Current Stage Details */}
                  <div>
                    <h3 className="text-sm font-medium mb-3">Stage Details</h3>
                    <div className="space-y-2">
                      {selectedWorkflow.stages.map((stage) => (
                        <Collapsible
                          key={stage.name}
                          open={expandedStage === stage.name}
                          onOpenChange={(open) => setExpandedStage(open ? stage.name : null)}
                        >
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                              <div className="flex items-center gap-3">
                                <ChevronRight className={`w-4 h-4 transition-transform ${
                                  expandedStage === stage.name ? 'rotate-90' : ''
                                }`} />
                                {getStatusIcon(stage.status)}
                                <span className="font-medium text-sm">{stage.name}</span>
                                {stage.surface && (
                                  <Badge variant="outline" className="text-xs">
                                    {stage.surface}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {stage.status === 'running' && (
                                  <Progress value={stage.progress} className="w-20 h-2" />
                                )}
                                <span className="text-xs text-gray-500">
                                  {stage.duration || `${stage.progress}%`}
                                </span>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="px-3 pb-3">
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                              {stage.agent && (
                                <div className="flex items-center gap-2 mb-2">
                                  <Bot className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm">Agent: {stage.agent}</span>
                                </div>
                              )}
                              {stage.status === 'running' && (
                                <div className="space-y-1 mt-3">
                                  <p className="text-sm font-medium">Output:</p>
                                  <div className="bg-white p-2 rounded border text-xs font-mono">
                                    <p className="text-green-600">✓ Generated 12 endpoints</p>
                                    <p className="text-green-600">✓ Applied authentication middleware</p>
                                    <p className="text-blue-600">⚡ Generating validation schemas...</p>
                                    <p className="text-gray-400">○ Pending: Error handling</p>
                                  </div>
                                </div>
                              )}
                              {stage.status === 'completed' && (
                                <div className="flex gap-2 mt-2">
                                  <Button variant="outline" size="sm">
                                    <Eye className="w-3 h-3 mr-1" />
                                    View Logs
                                  </Button>
                                  <Button variant="outline" size="sm">
                                    <Download className="w-3 h-3 mr-1" />
                                    Artifacts
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </div>

                  {/* Surfaces Involved */}
                  <div>
                    <h3 className="text-sm font-medium mb-3">Surfaces Involved</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedWorkflow.surfaces.map((surface) => (
                        <Badge key={surface} variant="secondary">
                          <GitBranch className="w-3 h-3 mr-1" />
                          {surface}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Terminal className="w-4 h-4 mr-1" />
                          View Logs
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-1" />
                          Download Artifacts
                        </Button>
                      </div>
                      {selectedWorkflow.status === 'completed' && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Copy className="w-4 h-4 mr-1" />
                            Clone
                          </Button>
                          <Button variant="outline" size="sm">
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Retry
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-[calc(100vh-240px)] flex items-center justify-center">
                <div className="text-center">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Select a workflow to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowManagement;