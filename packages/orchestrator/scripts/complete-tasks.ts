import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function completeTasksSimulation() {
  try {
    console.log('🚀 Starting task completion simulation...\n');

    // Get all pending tasks
    const pendingTasks = await prisma.agentTask.findMany({
      where: { status: 'pending' },
      select: { id: true, agent_type: true },
    });

    console.log(`Found ${pendingTasks.length} pending tasks\n`);

    if (pendingTasks.length === 0) {
      console.log('✅ No pending tasks to complete');
      await prisma.$disconnect();
      return;
    }

    // Update first 25 tasks with completion data
    let completed = 0;
    let failed = 0;

    for (const task of pendingTasks.slice(0, 25)) {
      try {
        // Randomly decide success/failure (80% success rate)
        const isSuccess = Math.random() > 0.2;
        const duration = Math.floor(Math.random() * 5000) + 500; // 500-5500ms
        const now = new Date();
        const startedAt = new Date(now.getTime() - duration - Math.random() * 5000);

        // Update task
        await prisma.agentTask.update({
          where: { id: task.id },
          data: {
            status: isSuccess ? 'completed' : 'failed',
            completed_at: now,
            started_at: startedAt,
            result: {
              output: isSuccess ? `Task completed by simulation` : `Task failed by simulation`,
              duration_ms: duration,
              timestamp: now.toISOString(),
            } as any,
          },
        });

        console.log(
          `${isSuccess ? '✅' : '❌'} ${task.agent_type}: ${task.id.slice(0, 8)} - ${duration}ms`
        );

        if (isSuccess) completed++;
        else failed++;
      } catch (error) {
        console.error(`Error processing task ${task.id}:`, error);
      }
    }

    console.log(`\n📊 Simulation Results:`);
    console.log(`  Completed: ${completed}`);
    console.log(`  Failed: ${failed}`);
    console.log(
      `  Success Rate: ${((completed / (completed + failed)) * 100).toFixed(1)}%\n`
    );

    // Verify the update worked
    const stats = await prisma.agentTask.groupBy({
      by: ['agent_type', 'status'],
      _count: { id: true },
    });

    console.log('📈 Task Status by Agent:');
    const byAgent: Record<string, Record<string, number>> = {};
    stats.forEach(row => {
      if (!byAgent[row.agent_type]) byAgent[row.agent_type] = {};
      byAgent[row.agent_type][row.status as string] = row._count.id;
    });

    Object.entries(byAgent).forEach(([agent, statuses]) => {
      console.log(`\n  ${agent}:`);
      Object.entries(statuses).forEach(([status, count]) => {
        console.log(`    ${status}: ${count}`);
      });
    });
  } catch (error) {
    console.error('❌ Simulation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

completeTasksSimulation();
