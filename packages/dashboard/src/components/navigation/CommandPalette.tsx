import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Layers, GitBranch, Bot, Plus, Settings, FileText } from 'lucide-react'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search platforms, workflows, agents..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() => runCommand(() => navigate('/platforms/new'))}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Create Platform</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate('/workflows/new'))}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>New Workflow</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate('/agents'))}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Register Agent</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => navigate('/'))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate('/platforms'))}
          >
            <Layers className="mr-2 h-4 w-4" />
            <span>Platforms</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate('/workflows'))}
          >
            <GitBranch className="mr-2 h-4 w-4" />
            <span>Workflows</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate('/agents'))}>
            <Bot className="mr-2 h-4 w-4" />
            <span>Agents</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate('/settings'))}
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
