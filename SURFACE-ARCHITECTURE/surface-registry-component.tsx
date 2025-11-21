// Surface Registry Component - Managing and configuring surfaces
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  GitBranch,
  Grid3x3,
  List,
  Network,
  Plus,
  Upload,
  Search,
  Filter,
  Code,
  Layout,
  Shield,
  Database,
  Globe,
  Lock,
  Layers,
  Bot,
  Settings,
  Eye,
  Edit,
  Copy,
  Trash2,
  ChevronRight,
  Info,
  CheckCircle
} from 'lucide-react';

interface Surface {
  id: string;
  name: string;
  type: 'Backend' | 'Frontend' | 'Cross-Cutting' | 'Infrastructure';
  layer: 'Service' | 'UI' | 'Data' | 'Integration';
  technology: string;
  agents: number;
  dependencies: string[];
  status: 'active' | 'inactive' | 'deprecated';
  version: string;
  lastModified: string;
  description?: string;
}

const surfaces: Surface[] = [
  {
    id: '1',
    name: 'API Surface',
    type: 'Backend',
    layer: 'Service',
    technology: 'Node.js',
    agents: 8,
    dependencies: ['Database', 'Auth'],
    status: 'active',
    version: '2.1.0',
    lastModified: '2 hours ago',
    description: 'REST API endpoints with OpenAPI specification'
  },
  {
    id: '2',
    name: 'Web UI Surface',
    type: 'Frontend',
    layer: 'UI',
    technology: 'React',
    agents: 5,
    dependencies: ['API Surface'],
    status: 'active',
    version: '1.8.2',
    lastModified: '1 day ago',
    description: 'Main web application user interface'
  },
  {
    id: '3',
    name: 'Admin Surface',
    type: 'Frontend',
    layer: 'UI',
    technology: 'Next.js',
    agents: 6,
    dependencies: ['API Surface', 'Auth'],
    status: 'active',
    version: '1.5.0',
    lastModified: '3 days ago',
    description: 'Administrative dashboard and controls'
  },
  {
    id: '4',
    name: 'Auth Surface',
    type: 'Cross-Cutting',
    layer: 'Service',
    technology: 'OAuth2',
    agents: 3,
    dependencies: [],
    status: 'active',
    version: '2.0.0',
    lastModified: '1 week ago',
    description: 'Authentication and authorization service'
  },
  {
    id: '5',
    name: 'Database Surface',
    type: 'Infrastructure',
    layer: 'Data',
    technology: 'PostgreSQL',
    agents: 4,
    dependencies: [],
    status: 'active',
    version: '14.5',
    lastModified: '2 weeks ago',
    description: 'Primary data storage and management'
  }
];

const getTypeIcon = (type: Surface['type']) => {
  switch (type) {
    case 'Backend':
      return <Code className="w-5 h-5" />;
    case 'Frontend':
      return <Layout className="w-5 h-5" />;
    case 'Cross-Cutting':
      return <Shield className="w-5 h-5" />;
    case 'Infrastructure':
      return <Database className="w-5 h-5" />;
    default:
      return <Layers className="w-5 h-5" />;
  }
};

const getTypeColor = (type: Surface['type']) => {
  switch (type) {
    case 'Backend':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Frontend':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'Cross-Cutting':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'Infrastructure':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

export const SurfaceRegistry: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'dependency'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedLayer, setSelectedLayer] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Surface Registry</h1>
            <p className="text-gray-600 mt-1">
              Manage and configure application surfaces
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Surface
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Surface</DialogTitle>
                  <DialogDescription>
                    Define a new surface for your platform architecture
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="surface-name">Surface Name</Label>
                      <Input
                        id="surface-name"
                        placeholder="e.g., Payment API Surface"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="surface-version">Version</Label>
                      <Input
                        id="surface-version"
                        placeholder="1.0.0"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="surface-type">Type</Label>
                      <Select defaultValue="backend">
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="backend">Backend</SelectItem>
                          <SelectItem value="frontend">Frontend</SelectItem>
                          <SelectItem value="cross-cutting">Cross-Cutting</SelectItem>
                          <SelectItem value="infrastructure">Infrastructure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="surface-layer">Layer</Label>
                      <Select defaultValue="service">
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="service">Service</SelectItem>
                          <SelectItem value="ui">UI</SelectItem>
                          <SelectItem value="data">Data</SelectItem>
                          <SelectItem value="integration">Integration</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="surface-tech">Technology Stack</Label>
                    <Input
                      id="surface-tech"
                      placeholder="e.g., Node.js, Express, TypeScript"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="surface-description">Description</Label>
                    <textarea
                      id="surface-description"
                      className="w-full mt-1 p-2 border rounded-md resize-none"
                      rows={3}
                      placeholder="Describe the purpose and functionality of this surface..."
                    />
                  </div>

                  <div>
                    <Label>Dependencies</Label>
                    <div className="mt-2 space-y-2">
                      {['Database Surface', 'Auth Surface', 'Cache Surface', 'Queue Surface'].map((dep) => (
                        <div key={dep} className="flex items-center space-x-2">
                          <Checkbox id={dep} />
                          <Label htmlFor={dep} className="font-normal cursor-pointer">
                            {dep}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setShowCreateDialog(false)}>
                    Create Surface
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search surfaces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="backend">Backend</SelectItem>
                <SelectItem value="frontend">Frontend</SelectItem>
                <SelectItem value="cross-cutting">Cross-Cutting</SelectItem>
                <SelectItem value="infrastructure">Infrastructure</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedLayer} onValueChange={setSelectedLayer}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Layers</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="ui">UI</SelectItem>
                <SelectItem value="data">Data</SelectItem>
                <SelectItem value="integration">Integration</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'dependency' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('dependency')}
            >
              <Network className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs value={viewMode} className="w-full">
          <TabsContent value="grid" className="mt-0">
            <div className="grid grid-cols-4 gap-4">
              {surfaces.map((surface) => (
                <Card key={surface.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getTypeColor(surface.type)}`}>
                        {getTypeIcon(surface.type)}
                      </div>
                      <Badge
                        variant={surface.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {surface.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-3">{surface.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {surface.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Type:</span>
                        <span className="font-medium">{surface.type}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Technology:</span>
                        <span className="font-medium">{surface.technology}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Agents:</span>
                        <div className="flex items-center gap-1">
                          <Bot className="w-3 h-3" />
                          <span className="font-medium">{surface.agents}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-3 flex justify-between">
                    <span className="text-xs text-gray-500">v{surface.version}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-4 font-medium text-sm">Surface Name</th>
                      <th className="text-left p-4 font-medium text-sm">Type</th>
                      <th className="text-left p-4 font-medium text-sm">Layer</th>
                      <th className="text-left p-4 font-medium text-sm">Technology</th>
                      <th className="text-left p-4 font-medium text-sm">Agents</th>
                      <th className="text-left p-4 font-medium text-sm">Status</th>
                      <th className="text-left p-4 font-medium text-sm">Version</th>
                      <th className="text-left p-4 font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surfaces.map((surface, index) => (
                      <tr key={surface.id} className={index !== surfaces.length - 1 ? 'border-b' : ''}>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded flex items-center justify-center ${getTypeColor(surface.type)}`}>
                              {getTypeIcon(surface.type)}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{surface.name}</p>
                              <p className="text-xs text-gray-500">{surface.lastModified}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="text-xs">
                            {surface.type}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm">{surface.layer}</td>
                        <td className="p-4 text-sm">{surface.technology}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Bot className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">{surface.agents}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge
                            variant={surface.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {surface.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm">v{surface.version}</td>
                        <td className="p-4">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dependency" className="mt-0">
            <Card className="h-[600px]">
              <CardHeader>
                <CardTitle>Surface Dependencies</CardTitle>
                <CardDescription>
                  Visual representation of surface relationships and dependencies
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative h-[480px] bg-gray-50 rounded-lg p-8">
                  {/* Simplified dependency graph visualization */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="relative">
                      {/* Central API Surface */}
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full">
                        <Card className="p-4 shadow-lg">
                          <div className="flex items-center gap-2">
                            <Code className="w-5 h-5 text-blue-600" />
                            <span className="font-medium">API Surface</span>
                          </div>
                        </Card>
                      </div>

                      {/* Web UI Surface */}
                      <div className="absolute top-1/2 left-0 transform -translate-x-full -translate-y-1/2">
                        <Card className="p-4 shadow-lg">
                          <div className="flex items-center gap-2">
                            <Layout className="w-5 h-5 text-purple-600" />
                            <span className="font-medium">Web UI</span>
                          </div>
                        </Card>
                      </div>

                      {/* Admin Surface */}
                      <div className="absolute top-1/2 right-0 transform translate-x-full -translate-y-1/2">
                        <Card className="p-4 shadow-lg">
                          <div className="flex items-center gap-2">
                            <Layout className="w-5 h-5 text-purple-600" />
                            <span className="font-medium">Admin Panel</span>
                          </div>
                        </Card>
                      </div>

                      {/* Auth Surface */}
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                        <Card className="p-4 shadow-lg">
                          <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-green-600" />
                            <span className="font-medium">Auth Surface</span>
                          </div>
                        </Card>
                      </div>

                      {/* Center node */}
                      <div className="w-4 h-4 bg-gray-400 rounded-full"></div>

                      {/* Connection lines (simplified) */}
                      <svg className="absolute inset-0 w-96 h-96 pointer-events-none" style={{ top: '-12rem', left: '-12rem' }}>
                        <line x1="192" y1="48" x2="192" y2="144" stroke="#d1d5db" strokeWidth="2" />
                        <line x1="48" y1="192" x2="144" y2="192" stroke="#d1d5db" strokeWidth="2" />
                        <line x1="240" y1="192" x2="336" y2="192" stroke="#d1d5db" strokeWidth="2" />
                        <line x1="192" y1="240" x2="192" y2="336" stroke="#d1d5db" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-4 bg-white rounded-lg p-3 shadow">
                    <p className="text-xs font-medium mb-2">Legend</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 bg-blue-100 rounded"></div>
                        <span>Backend</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 bg-purple-100 rounded"></div>
                        <span>Frontend</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 bg-green-100 rounded"></div>
                        <span>Cross-Cutting</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SurfaceRegistry;