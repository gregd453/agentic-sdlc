// Platform Details Component - Comprehensive platform management view
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Edit,
  Trash2,
  MoreVertical,
  Copy,
  Download,
  Upload,
  Settings,
  Play,
  GitBranch,
  Bot,
  Shield,
  Database,
  Globe,
  Lock,
  CheckCircle,
  AlertCircle,
  Activity,
  TrendingUp,
  Code,
  Layout,
  Plus,
  Save,
  X,
  ChevronRight,
  Info,
  FileCode,
  Package,
  Server,
  Layers
} from 'lucide-react';

interface PlatformConfig {
  name: string;
  type: string;
  technology: {
    frontend: string;
    backend: string;
    database: string;
    infrastructure: string;
  };
  environment: string;
  version: string;
  status: 'active' | 'inactive';
  surfaces: Array<{
    id: string;
    name: string;
    enabled: boolean;
    version: string;
    lastModified: string;
  }>;
  agents: Array<{
    name: string;
    type: string;
    version: string;
    status: 'active' | 'inactive';
  }>;
  policies: Array<{
    name: string;
    type: string;
    enabled: boolean;
  }>;
}

const platformData: PlatformConfig = {
  name: 'E-Commerce Platform',
  type: 'Web Application',
  technology: {
    frontend: 'Next.js 14',
    backend: 'Node.js + Express',
    database: 'PostgreSQL 15',
    infrastructure: 'AWS ECS'
  },
  environment: 'Production',
  version: '2.1.0',
  status: 'active',
  surfaces: [
    { id: '1', name: 'API Surface', enabled: true, version: '2.1.0', lastModified: '2 hours ago' },
    { id: '2', name: 'Web UI Surface', enabled: true, version: '1.8.2', lastModified: '1 day ago' },
    { id: '3', name: 'Admin Panel Surface', enabled: true, version: '1.5.0', lastModified: '3 days ago' },
    { id: '4', name: 'Mobile Surface', enabled: false, version: '1.0.0', lastModified: '1 week ago' },
    { id: '5', name: 'Auth Surface', enabled: true, version: '2.0.0', lastModified: '1 week ago' },
  ],
  agents: [
    { name: 'API Generator', type: 'Code Gen', version: '2.1.0', status: 'active' },
    { name: 'UI Builder', type: 'Frontend', version: '1.8.2', status: 'active' },
    { name: 'Test Creator', type: 'Testing', version: '1.5.0', status: 'active' },
    { name: 'Doc Generator', type: 'Docs', version: '1.2.3', status: 'inactive' },
  ],
  policies: [
    { name: 'Authentication Required', type: 'Security', enabled: true },
    { name: 'Rate Limiting', type: 'Performance', enabled: true },
    { name: 'HTTPS Only', type: 'Security', enabled: true },
    { name: 'Auto-scaling', type: 'Infrastructure', enabled: false },
  ]
};

export const PlatformDetails: React.FC = () => {
  const [platform, setPlatform] = useState(platformData);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleSurfaceToggle = (surfaceId: string) => {
    setPlatform(prev => ({
      ...prev,
      surfaces: prev.surfaces.map(s =>
        s.id === surfaceId ? { ...s, enabled: !s.enabled } : s
      )
    }));
  };

  const handlePolicyToggle = (policyName: string) => {
    setPlatform(prev => ({
      ...prev,
      policies: prev.policies.map(p =>
        p.name === policyName ? { ...p, enabled: !p.enabled } : p
      )
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{platform.name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant={platform.status === 'active' ? 'default' : 'secondary'}>
                  {platform.status === 'active' ? '● Active' : '○ Inactive'}
                </Badge>
                <span className="text-gray-600">Version {platform.version}</span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-600">{platform.environment}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Copy className="w-4 h-4 mr-2" />
              Clone
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button variant="outline" size="icon">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="surfaces">Surfaces</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configuration</CardTitle>
                  <CardDescription>Platform technical details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs text-gray-500">Name</Label>
                    {isEditing ? (
                      <Input value={platform.name} className="mt-1" />
                    ) : (
                      <p className="text-sm font-medium">{platform.name}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Type</Label>
                    {isEditing ? (
                      <Select defaultValue={platform.type}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Web Application">Web Application</SelectItem>
                          <SelectItem value="Mobile Application">Mobile Application</SelectItem>
                          <SelectItem value="API Service">API Service</SelectItem>
                          <SelectItem value="Microservices">Microservices</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium">{platform.type}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Technology Stack</Label>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Layout className="w-3 h-3 text-gray-400" />
                        <span className="text-sm">{platform.technology.frontend}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Server className="w-3 h-3 text-gray-400" />
                        <span className="text-sm">{platform.technology.backend}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Database className="w-3 h-3 text-gray-400" />
                        <span className="text-sm">{platform.technology.database}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Globe className="w-3 h-3 text-gray-400" />
                        <span className="text-sm">{platform.technology.infrastructure}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Environment</Label>
                    {isEditing ? (
                      <Select defaultValue={platform.environment}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Production">Production</SelectItem>
                          <SelectItem value="Staging">Staging</SelectItem>
                          <SelectItem value="Development">Development</SelectItem>
                          <SelectItem value="QA">QA</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm font-medium">{platform.environment}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Version</Label>
                    <p className="text-sm font-medium">{platform.version}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Surface Map */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Surface Map</CardTitle>
                  <CardDescription>Visual surface architecture</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative h-64 bg-gray-50 rounded-lg p-4">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className="relative">
                        {/* API Surface */}
                        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
                          <div className="bg-white p-2 rounded border shadow-sm">
                            <div className="flex items-center gap-1">
                              <Code className="w-3 h-3 text-blue-600" />
                              <span className="text-xs font-medium">API</span>
                            </div>
                          </div>
                        </div>

                        {/* Web UI */}
                        <div className="absolute top-0 -left-20">
                          <div className="bg-white p-2 rounded border shadow-sm">
                            <div className="flex items-center gap-1">
                              <Layout className="w-3 h-3 text-purple-600" />
                              <span className="text-xs font-medium">Web</span>
                            </div>
                          </div>
                        </div>

                        {/* Admin Panel */}
                        <div className="absolute top-0 left-20">
                          <div className="bg-white p-2 rounded border shadow-sm">
                            <div className="flex items-center gap-1">
                              <Settings className="w-3 h-3 text-gray-600" />
                              <span className="text-xs font-medium">Admin</span>
                            </div>
                          </div>
                        </div>

                        {/* Auth */}
                        <div className="absolute top-16 left-1/2 transform -translate-x-1/2">
                          <div className="bg-white p-2 rounded border shadow-sm">
                            <div className="flex items-center gap-1">
                              <Shield className="w-3 h-3 text-green-600" />
                              <span className="text-xs font-medium">Auth</span>
                            </div>
                          </div>
                        </div>

                        {/* Center node */}
                        <div className="w-3 h-3 bg-blue-600 rounded-full"></div>

                        {/* Connection lines */}
                        <svg className="absolute inset-0 w-40 h-40 pointer-events-none" style={{ top: '-5rem', left: '-5rem' }}>
                          <line x1="80" y1="20" x2="80" y2="70" stroke="#d1d5db" strokeWidth="1" />
                          <line x1="20" y1="80" x2="70" y2="80" stroke="#d1d5db" strokeWidth="1" />
                          <line x1="90" y1="80" x2="140" y2="80" stroke="#d1d5db" strokeWidth="1" />
                          <line x1="80" y1="90" x2="80" y2="140" stroke="#d1d5db" strokeWidth="1" />
                        </svg>
                      </div>
                    </div>

                    <div className="absolute bottom-2 right-2">
                      <Button variant="outline" size="sm">
                        <ChevronRight className="w-3 h-3 mr-1" />
                        Expand
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Workflows */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg">Recent Workflows</CardTitle>
                      <CardDescription>Latest executions</CardDescription>
                    </div>
                    <Button variant="outline" size="sm">
                      <Play className="w-3 h-3 mr-1" />
                      New
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">#234 Deploy API</p>
                        <p className="text-xs text-gray-500">2 hours ago</p>
                      </div>
                      <Badge variant="outline" className="text-xs text-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Complete
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">#233 Update Database</p>
                        <p className="text-xs text-gray-500">Running</p>
                      </div>
                      <Badge variant="default" className="text-xs">
                        <Activity className="w-3 h-3 mr-1" />
                        Running
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">#232 Generate Tests</p>
                        <p className="text-xs text-gray-500">5 hours ago</p>
                      </div>
                      <Badge variant="outline" className="text-xs text-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Complete
                      </Badge>
                    </div>
                  </div>
                  <Button variant="link" className="w-full text-xs">
                    View all workflows →
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Enabled Surfaces */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-lg">Enabled Surfaces</CardTitle>
                    <CardDescription>Surfaces active on this platform</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <Plus className="w-3 h-3 mr-1" />
                    Add Surface
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {platform.surfaces.map((surface) => (
                    <div key={surface.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={surface.enabled}
                          onCheckedChange={() => handleSurfaceToggle(surface.id)}
                        />
                        <GitBranch className={`w-4 h-4 ${surface.enabled ? 'text-blue-600' : 'text-gray-400'}`} />
                        <div>
                          <p className="text-sm font-medium">{surface.name}</p>
                          <p className="text-xs text-gray-500">Version {surface.version} • Modified {surface.lastModified}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={surface.enabled ? 'default' : 'secondary'} className="text-xs">
                          {surface.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Settings className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Surfaces Tab */}
          <TabsContent value="surfaces" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Surface Configuration</CardTitle>
                    <CardDescription>Manage surfaces for this platform</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </Button>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Surface
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Surface</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dependencies</TableHead>
                      <TableHead>Last Modified</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {platform.surfaces.map((surface) => (
                      <TableRow key={surface.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <GitBranch className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{surface.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{surface.version}</TableCell>
                        <TableCell>
                          <Switch
                            checked={surface.enabled}
                            onCheckedChange={() => handleSurfaceToggle(surface.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant="outline" className="text-xs">Auth</Badge>
                            <Badge variant="outline" className="text-xs">Database</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {surface.lastModified}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Settings className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600">
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Workflows Tab */}
          <TabsContent value="workflows" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Workflow History</CardTitle>
                    <CardDescription>Recent workflow executions for this platform</CardDescription>
                  </div>
                  <Button>
                    <Play className="w-4 h-4 mr-2" />
                    New Workflow
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Surfaces</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono">#234</TableCell>
                      <TableCell className="font-medium">Deploy API Updates</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">API</Badge>
                          <Badge variant="outline" className="text-xs">Auth</Badge>
                        </div>
                      </TableCell>
                      <TableCell>25m</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Completed
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">2 hours ago</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <FileCode className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">#233</TableCell>
                      <TableCell className="font-medium">Update Database Schema</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">Database</Badge>
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>
                        <Badge variant="default">
                          <Activity className="w-3 h-3 mr-1" />
                          Running
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">15 minutes ago</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <FileCode className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Registered Agents</CardTitle>
                    <CardDescription>Platform-specific agent configurations</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Register Agent
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {platform.agents.map((agent) => (
                    <div key={agent.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Bot className={`w-5 h-5 ${agent.status === 'active' ? 'text-blue-600' : 'text-gray-400'}`} />
                        <div>
                          <p className="text-sm font-medium">{agent.name}</p>
                          <p className="text-xs text-gray-500">{agent.type} • Version {agent.version}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {agent.status === 'active' ? '● Active' : '○ Inactive'}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Settings className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Settings</CardTitle>
                <CardDescription>Configure platform-specific policies and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-3">Security Policies</h3>
                  <div className="space-y-3">
                    {platform.policies.filter(p => p.type === 'Security').map((policy) => (
                      <div key={policy.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Shield className="w-4 h-4 text-gray-400" />
                          <Label htmlFor={policy.name} className="font-normal cursor-pointer">
                            {policy.name}
                          </Label>
                        </div>
                        <Switch
                          id={policy.name}
                          checked={policy.enabled}
                          onCheckedChange={() => handlePolicyToggle(policy.name)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-3">Performance Policies</h3>
                  <div className="space-y-3">
                    {platform.policies.filter(p => p.type === 'Performance').map((policy) => (
                      <div key={policy.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <TrendingUp className="w-4 h-4 text-gray-400" />
                          <Label htmlFor={policy.name} className="font-normal cursor-pointer">
                            {policy.name}
                          </Label>
                        </div>
                        <Switch
                          id={policy.name}
                          checked={policy.enabled}
                          onCheckedChange={() => handlePolicyToggle(policy.name)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-3">Infrastructure Policies</h3>
                  <div className="space-y-3">
                    {platform.policies.filter(p => p.type === 'Infrastructure').map((policy) => (
                      <div key={policy.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Server className="w-4 h-4 text-gray-400" />
                          <Label htmlFor={policy.name} className="font-normal cursor-pointer">
                            {policy.name}
                          </Label>
                        </div>
                        <Switch
                          id={policy.name}
                          checked={policy.enabled}
                          onCheckedChange={() => handlePolicyToggle(policy.name)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button>Save Settings</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Platform?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{platform.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(false)}>
              Delete Platform
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlatformDetails;