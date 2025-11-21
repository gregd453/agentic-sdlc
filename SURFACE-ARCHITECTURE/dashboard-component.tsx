// Dashboard Component - Main landing page for Zyp Platform
import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Layers,
  GitBranch,
  Bot,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  MoreVertical,
  Plus,
  Search,
  Bell,
  User
} from 'lucide-react';

interface DashboardProps {
  user: {
    name: string;
    avatar?: string;
  };
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Layers className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-semibold">Zyp Platform</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search platforms, surfaces, workflows..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-96 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </Button>

            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium">{user.name}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {/* Welcome Section */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user.name}
            </h1>
            <p className="text-gray-600 mt-1">
              Here's what's happening with your platforms today
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline">
              <Clock className="w-4 h-4 mr-2" />
              Quick Actions
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Workflow
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Platforms
                  </CardTitle>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold">12</span>
                    <Badge variant="secondary" className="text-xs">
                      +2 this week
                    </Badge>
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Layers className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 mt-2">
                <div className="w-full bg-blue-600 h-1 rounded"></div>
                <div className="w-full bg-blue-600 h-1 rounded"></div>
                <div className="w-full bg-blue-600 h-1 rounded"></div>
                <div className="w-full bg-blue-600 h-1 rounded"></div>
                <div className="w-full bg-blue-600 h-1 rounded"></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Surfaces
                  </CardTitle>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold">48</span>
                    <Badge variant="secondary" className="text-xs">
                      5 active
                    </Badge>
                  </div>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <GitBranch className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 mt-2">
                <div className="w-full bg-purple-600 h-1 rounded"></div>
                <div className="w-full bg-purple-600 h-1 rounded"></div>
                <div className="w-full bg-purple-600 h-1 rounded"></div>
                <div className="w-full bg-purple-600 h-1 rounded"></div>
                <div className="w-full bg-purple-600 h-1 rounded"></div>
                <div className="w-full bg-purple-600 h-1 rounded"></div>
                <div className="w-full bg-purple-600 h-1 rounded"></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Workflows
                  </CardTitle>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold">156</span>
                    <Badge variant="secondary" className="text-xs">
                      89% success
                    </Badge>
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 mt-2">
                <div className="w-full bg-green-600 h-1 rounded"></div>
                <div className="w-full bg-green-600 h-1 rounded"></div>
                <div className="w-full bg-green-600 h-1 rounded"></div>
                <div className="w-full bg-green-600 h-1 rounded"></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-sm font-medium text-gray-600">
                    Agents
                  </CardTitle>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold">24</span>
                    <Badge variant="secondary" className="text-xs">
                      100% online
                    </Badge>
                  </div>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Bot className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 mt-2">
                <div className="w-full bg-orange-600 h-1 rounded"></div>
                <div className="w-full bg-orange-600 h-1 rounded"></div>
                <div className="w-full bg-orange-600 h-1 rounded"></div>
                <div className="w-full bg-orange-600 h-1 rounded"></div>
                <div className="w-full bg-orange-600 h-1 rounded"></div>
                <div className="w-full bg-orange-600 h-1 rounded"></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity and Platform Health */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest system events and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Workflow #234 completed</p>
                    <p className="text-xs text-gray-500">E-Commerce Platform • 2 minutes ago</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Activity className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Surface API updated</p>
                    <p className="text-xs text-gray-500">Version 2.1.0 deployed • 15 minutes ago</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Bot className="w-5 h-5 text-purple-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">New agent registered</p>
                    <p className="text-xs text-gray-500">Security Scanner v3.0 • 1 hour ago</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Platform config changed</p>
                    <p className="text-xs text-gray-500">Mobile Banking App • 2 hours ago</p>
                  </div>
                </div>
              </div>

              <Button variant="link" className="mt-4 p-0">
                View all activity →
              </Button>
            </CardContent>
          </Card>

          {/* Platform Health */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Health</CardTitle>
              <CardDescription>System status and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Production</span>
                    <span className="text-sm text-gray-600">98.5%</span>
                  </div>
                  <Progress value={98.5} className="h-2" />
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">Healthy</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Staging</span>
                    <span className="text-sm text-gray-600">100%</span>
                  </div>
                  <Progress value={100} className="h-2" />
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">Healthy</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Development</span>
                    <span className="text-sm text-gray-600">100%</span>
                  </div>
                  <Progress value={100} className="h-2" />
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">Healthy</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">QA</span>
                    <span className="text-sm text-gray-600">97.2%</span>
                  </div>
                  <Progress value={97.2} className="h-2" />
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">Minor issues</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Workflows */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Active Workflows</CardTitle>
                <CardDescription>Currently running and queued workflows</CardDescription>
              </div>
              <Button variant="outline" size="sm">
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="running" className="w-full">
              <TabsList>
                <TabsTrigger value="running">Running (3)</TabsTrigger>
                <TabsTrigger value="queued">Queued (5)</TabsTrigger>
                <TabsTrigger value="completed">Completed Today (12)</TabsTrigger>
              </TabsList>

              <TabsContent value="running" className="mt-4">
                <div className="space-y-3">
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">#236 Deploy E-Commerce Updates</p>
                        <p className="text-sm text-gray-600">Platform: Production</p>
                      </div>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                    <Progress value={75} className="h-2 mb-2" />
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>Current: Generating API code</span>
                      <span>Time: 12m • ETA: 4m</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline">View Details</Button>
                      <Button size="sm" variant="outline">Pause</Button>
                      <Button size="sm" variant="outline" className="text-red-600">Cancel</Button>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">#235 Generate Mobile App Screens</p>
                        <p className="text-sm text-gray-600">Platform: Development</p>
                      </div>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                    <Progress value={45} className="h-2 mb-2" />
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>Current: Planning phase</span>
                      <span>Time: 8m • ETA: 10m</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline">View Details</Button>
                      <Button size="sm" variant="outline">Pause</Button>
                      <Button size="sm" variant="outline" className="text-red-600">Cancel</Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="queued" className="mt-4">
                <div className="space-y-2">
                  {['#237 API Migration', '#238 UI Refresh', '#239 Security Audit', '#240 Database Schema Update', '#241 Performance Optimization'].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <span className="text-sm font-medium">{item}</span>
                      <Badge variant="secondary">Queued</Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="completed" className="mt-4">
                <div className="space-y-2">
                  {[
                    { id: '#234', name: 'Database Update', time: '2 hours ago' },
                    { id: '#233', name: 'Test Generation', time: '3 hours ago' },
                    { id: '#232', name: 'Code Review', time: '4 hours ago' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <span className="text-sm font-medium">{item.id} {item.name}</span>
                        <span className="text-xs text-gray-500 ml-2">{item.time}</span>
                      </div>
                      <Badge variant="outline" className="text-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Completed
                      </Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;