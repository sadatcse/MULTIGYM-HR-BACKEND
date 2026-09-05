import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskReminderService } from './task-reminder.service';
import { CreateTaskDto, SubtaskItemDto } from './dto/create-task.dto';
import {
  UpdateTaskDto,
  UpdateProgressDto,
  UploadProofDto,
  BatchUploadProofDto,
  SubmitTaskDto,
  ApproveTaskDto,
  RejectTaskDto,
  ExtendDeadlineDto,
  CancelTaskDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/task-actions.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('task')
@UseGuards(JwtAuthGuard)
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly reminderService: TaskReminderService,
  ) {}

  // 1. Employee: My Personal Tasks
  @Get('my-tasks')
  async getMyTasks(@Query() query: any, @Req() req: any) {
    const data = await this.taskService.getMyTasks(query, req.user);
    return { success: true, data };
  }

  // 2. Dashboard KPIs & Overview
  @Get('dashboard')
  async getDashboardStats(@Req() req: any) {
    const data = await this.taskService.getDashboardStats(req.user);
    return { success: true, data };
  }

  // 3. Management Follow-up Queue
  @Get('follow-up')
  async getFollowUpList(@Query() query: any) {
    const data = await this.taskService.getFollowUpList(query);
    return { success: true, data };
  }

  // 4. Reports (source-wise, branch-wise, employee-wise)
  @Get('reports/:type')
  async getReports(@Param('type') type: string, @Query() query: any) {
    const data = await this.taskService.getReports(type, query);
    return { success: true, data };
  }

  // 5. Calendar Tasks
  @Get('calendar')
  async getCalendarTasks(
    @Query('month') month: string,
    @Query('year') year: string,
    @Req() req: any,
  ) {
    const m = month !== undefined ? parseInt(month, 10) : undefined;
    const y = year !== undefined ? parseInt(year, 10) : undefined;
    const data = await this.taskService.getCalendarTasks(m, y, req.user);
    return { success: true, data };
  }

  // 6. Header Bell Live Alerts
  @Get('alerts')
  async getAlerts(@Req() req: any) {
    const data = await this.taskService.getAlerts(req.user);
    return { success: true, data };
  }

  // 7. Categories
  @Get('categories')
  async getCategories() {
    const data = await this.taskService.getCategories();
    return { success: true, data };
  }

  @Post('categories')
  @UseGuards(PermissionsGuard)
  @RequirePermission('task-categories', 'add')
  async createCategory(@Body() dto: CreateCategoryDto) {
    const data = await this.taskService.createCategory(dto);
    return { success: true, data, message: 'Category created successfully' };
  }

  @Put('categories/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('task-categories', 'edit')
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    const data = await this.taskService.updateCategory(id, dto);
    return { success: true, data, message: 'Category updated successfully' };
  }

  @Delete('categories/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('task-categories', 'delete')
  async deleteCategory(@Param('id') id: string) {
    return this.taskService.deleteCategory(id);
  }

  // 8. Trigger Reminders / Overdue Scan On-Demand
  @Post('reminders/process')
  async processReminders() {
    const stats = await this.reminderService.evaluateAllTasks();
    return { success: true, message: 'Reminder scan completed', data: stats };
  }

  // 9. Employee Performance Analytics & History (Requirement 8 & 9)
  @Get('employee-performance/:employeeId')
  async getEmployeePerformance(
    @Param('employeeId') employeeId: string,
    @Query() query: any,
  ) {
    const data = await this.taskService.getEmployeePerformance(employeeId, query);
    return { success: true, data };
  }

  // 10. Task Directory List
  @Get()
  async findAll(@Query() query: any, @Req() req: any) {
    const data = await this.taskService.findAll(query, req.user);
    return { success: true, data };
  }

  // 11. Create Task (Admin / Management)
  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermission('tasks', 'add')
  async create(@Body() dto: CreateTaskDto, @Req() req: any) {
    const data = await this.taskService.createTask(dto, req.user);
    return { success: true, data, message: 'Instruction task created and dispatched successfully' };
  }

  // 12. Get Task Detail
  @Get(':id')
  async findById(@Param('id') id: string, @Req() req: any) {
    const data = await this.taskService.findById(id, req.user);
    return { success: true, data };
  }

  // 12. Update Task Basic Details
  @Put(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tasks', 'edit')
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Req() req: any) {
    const data = await this.taskService.updateTask(id, dto, req.user);
    return { success: true, data, message: 'Task updated successfully' };
  }

  // 13. Employee: Start Task
  @Post(':id/start')
  async startTask(@Param('id') id: string, @Req() req: any) {
    const data = await this.taskService.startTask(id, req.user);
    return { success: true, data };
  }

  // 14. Employee: Update Progress
  @Post(':id/progress')
  async updateProgress(
    @Param('id') id: string,
    @Body() dto: UpdateProgressDto,
    @Req() req: any,
  ) {
    const data = await this.taskService.updateProgress(id, dto, req.user);
    return { success: true, data };
  }

  // 15. Employee: Upload Proof
  @Post(':id/proof')
  async uploadProof(
    @Param('id') id: string,
    @Body() dto: UploadProofDto,
    @Req() req: any,
  ) {
    const data = await this.taskService.uploadProof(id, dto, req.user);
    return { success: true, data };
  }

  // 15b. Employee: Batch Upload Multiple Proofs (Requirement 2)
  @Post(':id/proofs/batch')
  async batchUploadProofs(
    @Param('id') id: string,
    @Body() dto: BatchUploadProofDto,
    @Req() req: any,
  ) {
    const data = await this.taskService.batchUploadProofs(id, dto, req.user);
    return { success: true, data };
  }

  // 15c. Subtask Management (Requirement 1)
  @Post(':id/subtasks')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tasks', 'edit')
  async addSubtask(
    @Param('id') id: string,
    @Body() dto: SubtaskItemDto,
    @Req() req: any,
  ) {
    const data = await this.taskService.addSubtask(id, dto, req.user);
    return { success: true, data };
  }

  @Put(':id/subtasks/:subtaskId')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tasks', 'edit')
  async updateSubtask(
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
    @Body() dto: SubtaskItemDto,
    @Req() req: any,
  ) {
    const data = await this.taskService.updateSubtask(id, subtaskId, dto, req.user);
    return { success: true, data };
  }

  @Delete(':id/subtasks/:subtaskId')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tasks', 'edit')
  async deleteSubtask(
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
    @Req() req: any,
  ) {
    const data = await this.taskService.deleteSubtask(id, subtaskId, req.user);
    return { success: true, data };
  }

  // 16. Employee: Submit for Approval
  @Post(':id/submit')
  async submitForApproval(
    @Param('id') id: string,
    @Body() dto: SubmitTaskDto,
    @Req() req: any,
  ) {
    const data = await this.taskService.submitForApproval(id, dto, req.user);
    return { success: true, data };
  }

  // 17. Management: Approve Task
  @Post(':id/approve')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tasks', 'edit')
  async approveTask(
    @Param('id') id: string,
    @Body() dto: ApproveTaskDto,
    @Req() req: any,
  ) {
    const data = await this.taskService.approveTask(id, dto, req.user);
    return { success: true, data };
  }

  // 18. Management: Reject Task
  @Post(':id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tasks', 'edit')
  async rejectTask(
    @Param('id') id: string,
    @Body() dto: RejectTaskDto,
    @Req() req: any,
  ) {
    const data = await this.taskService.rejectTask(id, dto, req.user);
    return { success: true, data };
  }

  // 19. Direct Complete (approval not required)
  @Post(':id/complete')
  async completeTaskDirect(@Param('id') id: string, @Req() req: any) {
    const data = await this.taskService.completeTaskDirect(id, req.user);
    return { success: true, data };
  }

  // 20. Extend Deadline (Admin / Management)
  @Post(':id/extend-deadline')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tasks', 'edit')
  async extendDeadline(
    @Param('id') id: string,
    @Body() dto: ExtendDeadlineDto,
    @Req() req: any,
  ) {
    const data = await this.taskService.extendDeadline(id, dto, req.user);
    return { success: true, data };
  }

  // 21. Cancel Task (Admin / Management)
  @Post(':id/cancel')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tasks', 'edit')
  async cancelTask(
    @Param('id') id: string,
    @Body() dto: CancelTaskDto,
    @Req() req: any,
  ) {
    const data = await this.taskService.cancelTask(id, dto, req.user);
    return { success: true, data };
  }

  // 22. Delete Task (Admin only)
  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('tasks', 'delete')
  async deleteTask(@Param('id') id: string) {
    const data = await this.taskService.deleteTask(id);
    return { success: true, data };
  }
}
