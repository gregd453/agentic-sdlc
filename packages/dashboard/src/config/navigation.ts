import {
  LayoutDashboard,
  Layers,
  Grid,
  GitBranch,
  Bot,
  BarChart3,
  Settings,
  Shield,
  Users,
  Activity,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  description?: string
  badge?: string | number
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navigationConfig = {
  main: [
    {
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      description: 'Overview and metrics',
    },
    {
      label: 'Monitoring',
      href: '/monitoring',
      icon: Activity,
      description: 'Real-time system health',
    },
    {
      label: 'Platforms',
      href: '/platforms',
      icon: Layers,
      description: 'Manage platforms and configurations',
    },
    {
      label: 'Surfaces',
      href: '/surfaces',
      icon: Grid,
      description: 'Surface registry and designer',
    },
    {
      label: 'Workflows',
      href: '/workflows',
      icon: GitBranch,
      description: 'Active and historical workflows',
    },
    {
      label: 'Agents',
      href: '/agents',
      icon: Bot,
      description: 'Agent registry and configuration',
    },
    {
      label: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
      description: 'Platform metrics and insights',
    },
  ] as NavItem[],
  settings: [
    {
      label: 'Settings',
      href: '/settings',
      icon: Settings,
      description: 'Application settings',
    },
    {
      label: 'Policies',
      href: '/policies',
      icon: Shield,
      description: 'Security and access policies',
    },
    {
      label: 'Users',
      href: '/users',
      icon: Users,
      description: 'User management',
    },
  ] as NavItem[],
}
