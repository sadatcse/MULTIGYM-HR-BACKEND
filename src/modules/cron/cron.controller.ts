import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { TaskReminderService } from '../task/task-reminder.service';
import { UnifiedReminderService } from '../accountability/unified-reminder.service';

// Vercel's free (Hobby) plan only allows cron jobs to fire once per day, so
// this is a single consolidated endpoint covering both reminder engines
// rather than one cron entry each — see vercel.json's `crons` array, which
// is the only thing that calls this route.
//
// TaskReminderService/UnifiedReminderService also still run their own
// setInterval-based 15-minute scan (see their onModuleInit) for when this
// backend runs as a normal always-on process (local dev, or any host other
// than Vercel serverless) — a frozen/suspended serverless function can't
// reliably fire an in-process timer, which is why this HTTP-triggered path
// exists at all for the Vercel deployment.
@Controller('cron')
export class CronController {
  constructor(
    private readonly taskReminderService: TaskReminderService,
    private readonly unifiedReminderService: UnifiedReminderService,
  ) {}

  // Vercel Cron Jobs always trigger via a GET request.
  @Get('run-reminders')
  async runReminders(@Headers('authorization') authHeader?: string) {
    const secret = process.env.CRON_SECRET;
    if (!secret || authHeader !== `Bearer ${secret}`) {
      throw new UnauthorizedException();
    }

    const [taskStats, accountabilityResult] = await Promise.all([
      this.taskReminderService.evaluateAllTasks(),
      this.unifiedReminderService.evaluateAllCommunications(),
    ]);

    return { success: true, taskStats, accountabilityResult };
  }
}
