# MVP IMPLEMENTATION PLAN - AGENTIC SDLC

**Version:** 1.0
**Created:** 2025-11-05
**Purpose:** Minimal viable implementation to bootstrap the Agentic SDLC system

---

## Phase 0: MVP Core Components (Week 1)

### Objective
Create the absolute minimum needed to have a self-building system that can enhance itself.

### Core Components Required

```
┌─────────────────────────────────────────────────────────────┐
│                     MVP ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐        ┌──────────────┐                  │
│  │  Simple      │        │   Basic      │                  │
│  │  Orchestrator│◄──────►│   Agent      │                  │
│  └──────┬───────┘        └──────┬───────┘                  │
│         │                        │                           │
│         ▼                        ▼                           │
│  ┌──────────────┐        ┌──────────────┐                  │
│  │   Task       │        │   File       │                  │
│  │   Queue      │        │   System     │                  │
│  │  (JSON)      │        │  Operations  │                  │
│  └──────────────┘        └──────────────┘                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## MVP Implementation Components

### 1. Basic Orchestrator (`/orchestrator`)

```typescript
// orchestrator/src/index.ts
import { Queue } from './queue';
import { Agent } from './agent';
import { Pipeline } from './pipeline';

export class Orchestrator {
  private queue: Queue;
  private agents: Map<string, Agent>;
  private pipeline: Pipeline;

  constructor() {
    this.queue = new Queue('./backlog/tasks.json');
    this.agents = new Map();
    this.pipeline = new Pipeline();
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Agentic SDLC Orchestrator...');

    // Load backlog
    const tasks = await this.queue.getTasks();

    // Process tasks
    for (const task of tasks) {
      await this.processTask(task);
    }
  }

  private async processTask(task: Task): Promise<void> {
    console.log(`📋 Processing: ${task.title}`);

    // Select agent based on task type
    const agent = this.selectAgent(task.type);

    // Execute task
    const result = await agent.execute(task);

    // Run pipeline if needed
    if (result.requiresPipeline) {
      await this.pipeline.run(result);
    }
  }
}
```

### 2. Basic Agent (`/agents/base-agent`)

```typescript
// agents/base-agent/src/index.ts
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

export class BaseAgent {
  constructor(
    public readonly name: string,
    public readonly type: string
  ) {}

  async execute(task: Task): Promise<Result> {
    console.log(`🤖 ${this.name} executing: ${task.title}`);

    switch (task.type) {
      case 'scaffold':
        return await this.scaffold(task);
      case 'test':
        return await this.runTests(task);
      case 'validate':
        return await this.validate(task);
      default:
        return await this.defaultHandler(task);
    }
  }

  private async scaffold(task: Task): Promise<Result> {
    // Create basic project structure
    const projectPath = `./${task.name}`;

    // Create directories
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(`${projectPath}/src`, { recursive: true });
    await fs.mkdir(`${projectPath}/tests`, { recursive: true });

    // Create package.json
    const packageJson = {
      name: task.name,
      version: '0.0.1',
      scripts: {
        start: 'node src/index.js',
        test: 'jest',
        build: 'tsc'
      },
      dependencies: {},
      devDependencies: {
        '@types/node': '20.0.0',
        'typescript': '5.0.0',
        'jest': '29.0.0'
      }
    };

    await fs.writeFile(
      `${projectPath}/package.json`,
      JSON.stringify(packageJson, null, 2)
    );

    // Create basic index file
    await fs.writeFile(
      `${projectPath}/src/index.js`,
      `console.log('${task.name} initialized');`
    );

    return {
      success: true,
      message: `Scaffolded ${task.name}`,
      requiresPipeline: true,
      path: projectPath
    };
  }
}
```

### 3. Simple Task Queue (`/queue`)

```typescript
// queue/src/index.ts
import * as fs from 'fs/promises';

export class Queue {
  constructor(private filePath: string) {}

  async getTasks(): Promise<Task[]> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data).tasks;
    } catch {
      return [];
    }
  }

  async addTask(task: Task): Promise<void> {
    const tasks = await this.getTasks();
    tasks.push(task);
    await this.saveTasks(tasks);
  }

  async updateTask(id: string, status: string): Promise<void> {
    const tasks = await this.getTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.status = status;
      await this.saveTasks(tasks);
    }
  }

  private async saveTasks(tasks: Task[]): Promise<void> {
    await fs.writeFile(
      this.filePath,
      JSON.stringify({ tasks }, null, 2)
    );
  }
}
```

### 4. Basic Pipeline (`/pipeline`)

```typescript
// pipeline/src/index.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class Pipeline {
  async run(result: Result): Promise<void> {
    console.log('🔄 Running pipeline...');

    const stages = [
      { name: 'install', command: 'npm install' },
      { name: 'build', command: 'npm run build' },
      { name: 'test', command: 'npm test' },
      { name: 'validate', command: 'npm run validate' }
    ];

    for (const stage of stages) {
      console.log(`  ▶ ${stage.name}`);
      try {
        await execAsync(stage.command, { cwd: result.path });
        console.log(`  ✅ ${stage.name} passed`);
      } catch (error) {
        console.log(`  ❌ ${stage.name} failed`);
        throw error;
      }
    }

    console.log('✅ Pipeline complete');
  }
}
```

### 5. Bootstrap Script (`/bootstrap.sh`)

```bash
#!/bin/bash
set -e

echo "🚀 Bootstrapping Agentic SDLC System..."

# Create directory structure
mkdir -p orchestrator/src
mkdir -p agents/base-agent/src
mkdir -p queue/src
mkdir -p pipeline/src
mkdir -p backlog
mkdir -p scripts

# Initialize npm packages
for dir in orchestrator agents/base-agent queue pipeline; do
  cd $dir
  npm init -y
  npm install typescript @types/node --save-dev
  cd ..
done

# Create initial backlog
cat > backlog/tasks.json << 'EOF'
{
  "tasks": [
    {
      "id": "BOOT-001",
      "type": "scaffold",
      "title": "Create orchestrator service",
      "name": "orchestrator-service",
      "priority": "critical",
      "status": "ready"
    },
    {
      "id": "BOOT-002",
      "type": "scaffold",
      "title": "Create scaffold agent",
      "name": "scaffold-agent",
      "priority": "critical",
      "status": "ready"
    },
    {
      "id": "BOOT-003",
      "type": "scaffold",
      "title": "Create validation agent",
      "name": "validation-agent",
      "priority": "high",
      "status": "ready"
    }
  ]
}
EOF

echo "✅ Bootstrap complete!"
echo ""
echo "Next steps:"
echo "1. Run: npm install"
echo "2. Run: npm run build"
echo "3. Run: npm start"
```

---

## MVP Package Structure

```
agentic-sdlc-mvp/
├── orchestrator/
│   ├── src/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── agents/
│   └── base-agent/
│       ├── src/
│       │   ├── index.ts
│       │   └── types.ts
│       ├── package.json
│       └── tsconfig.json
│
├── queue/
│   ├── src/
│   │   └── index.ts
│   └── package.json
│
├── pipeline/
│   ├── src/
│   │   └── index.ts
│   └── package.json
│
├── backlog/
│   └── tasks.json
│
├── scripts/
│   ├── start.sh
│   └── bootstrap.sh
│
├── package.json (root)
└── README.md
```

---

## Root Package.json

```json
{
  "name": "agentic-sdlc-mvp",
  "version": "0.0.1",
  "description": "Minimal Viable Agentic SDLC System",
  "scripts": {
    "bootstrap": "./scripts/bootstrap.sh",
    "build": "npm run build:all",
    "build:all": "npm run build:orchestrator && npm run build:agents",
    "build:orchestrator": "cd orchestrator && npm run build",
    "build:agents": "cd agents/base-agent && npm run build",
    "start": "node orchestrator/dist/index.js",
    "dev": "npm run build && npm start",
    "clean": "rm -rf */dist */node_modules"
  },
  "workspaces": [
    "orchestrator",
    "agents/*",
    "queue",
    "pipeline"
  ],
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

---

## TypeScript Configuration

```json
// tsconfig.json (shared)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Quick Start Commands

```bash
# 1. Clone and setup
git clone <repo>
cd agentic-sdlc-mvp

# 2. Bootstrap the system
npm run bootstrap

# 3. Install dependencies
npm install

# 4. Build everything
npm run build

# 5. Start the orchestrator
npm start
```

---

## MVP Capabilities

### What It Can Do:
1. ✅ Read tasks from backlog
2. ✅ Execute basic agent operations
3. ✅ Create project scaffolds
4. ✅ Run simple pipelines
5. ✅ Track task status

### What It Can't Do (Yet):
1. ❌ Complex decision negotiation
2. ❌ Sprint management
3. ❌ Advanced testing
4. ❌ Cloud deployment
5. ❌ Human escalation

---

## Next Steps After MVP

Once the MVP is running, it can:
1. Build its own enhancement agents
2. Improve its own pipeline
3. Add more sophisticated features
4. Integrate with CI/CD platforms
5. Add the full architecture components

The key is that once this MVP is running, **it can build itself better**.

---

## Success Criteria for MVP

- [ ] Orchestrator starts and reads backlog
- [ ] Agent can scaffold a basic project
- [ ] Pipeline can run npm commands
- [ ] Task status updates work
- [ ] System can add new tasks to backlog
- [ ] Basic error handling works

Once these work, the system can start building the full architecture using its own capabilities.