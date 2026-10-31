import { Body, Controller, Delete, Get, Headers, Ip, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { HrLetterService } from './hr-letter.service';
import { CreateLetterDto, PreviewLetterDto, UpdateDraftDto } from './dto/create-letter.dto';
import { ReissueLetterDto } from './dto/reissue-letter.dto';
import { QueryLetterDto } from './dto/query-letter.dto';
import { CancelLetterDto, ClientAuditDto } from './dto/letter-action.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { HrAccessService } from '../hr-config/hr-access.service';

// Every action resolves the signed-in employee into an Actor so letters
// record who really generated them and branch-scoped HR staff only reach
// their own branches' letters.
@Controller('hr-letters')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HrLetterController {
  constructor(
    private readonly hrLetterService: HrLetterService,
    private readonly access: HrAccessService,
  ) {}

  private actor(req: any) {
    return this.access.getActor(req.user);
  }

  @Get('stats')
  @RequirePermission('hr-letters', 'view')
  async getStats(@Req() req: any) {
    return { success: true, data: await this.hrLetterService.getStats(await this.actor(req)) };
  }

  @Get('next-number')
  @RequirePermission('hr-letters', 'view')
  async getNextNumberPreview(@Query('letterType') letterType: string, @Query('letterDate') letterDate?: string) {
    const data = await this.hrLetterService.getNextLetterNumberPreview(letterType || 'appointment', letterDate);
    return { success: true, data: { nextLetterNumber: data } };
  }

  // ----- Templates -----------------------------------------------------------

  @Get('templates')
  @RequirePermission('hr-letters', 'view')
  async getAllTemplates() {
    return { success: true, data: await this.hrLetterService.getAllTemplates() };
  }

  @Get('templates/:type')
  @RequirePermission('hr-letters', 'view')
  async getTemplateForType(@Param('type') type: string) {
    return { success: true, data: await this.hrLetterService.getTemplateForType(type) };
  }

  @Put('templates/:id')
  @RequirePermission('hr-letters', 'edit')
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto, @Req() req: any, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    const data = await this.hrLetterService.updateTemplate(id, dto, await this.actor(req), { ip, userAgent });
    return { success: true, data, message: 'Template saved' };
  }

  @Post('templates/:id/reset')
  @RequirePermission('hr-letters', 'edit')
  async resetTemplate(@Param('id') id: string, @Req() req: any, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    const data = await this.hrLetterService.resetTemplate(id, await this.actor(req), { ip, userAgent });
    return { success: true, data, message: 'Template restored to the built-in default' };
  }

  // Renders the template with sample data; the body may carry unsaved edits.
  @Post('templates/:id/preview')
  @RequirePermission('hr-letters', 'view')
  async previewTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return { success: true, data: await this.hrLetterService.previewTemplate(id, dto) };
  }

  // ----- Audit ---------------------------------------------------------------

  @Get('audit-history')
  @RequirePermission('hr-letters', 'view')
  async getAuditHistory(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('action') action?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const data = await this.hrLetterService.getAuditLogs(
      { page: parseInt(page || '1', 10) || 1, limit: parseInt(limit || '20', 10) || 20, search, action, startDate, endDate },
      await this.actor(req),
    );
    return { success: true, ...data };
  }

  // ----- My Letters (employee self-service) -----------------------------------
  // "my-letters" is a self-service key: every employee may use it unless a
  // role explicitly turns it off in Role Access Control. Declared before
  // ":id" so "my" is not read as a letter id.

  @Get('my')
  @RequirePermission('my-letters', 'view')
  async myLetters(@Req() req: any) {
    return { success: true, data: await this.hrLetterService.getMyLetters(await this.actor(req)) };
  }

  @Get('my/:id')
  @RequirePermission('my-letters', 'view')
  async myLetter(@Param('id') id: string, @Req() req: any) {
    return { success: true, data: await this.hrLetterService.getMyLetter(id, await this.actor(req)) };
  }

  @Post('my/:id/audit')
  @RequirePermission('my-letters', 'view')
  async logMyAction(@Param('id') id: string, @Body() dto: ClientAuditDto, @Req() req: any, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    await this.hrLetterService.logMyAction(id, dto.action, await this.actor(req), { ip, userAgent });
    return { success: true };
  }

  // ----- Letters -------------------------------------------------------------

  @Get('employee/:employeeId')
  @RequirePermission('hr-letters', 'view')
  async getEmployeeLetters(@Param('employeeId') employeeId: string, @Req() req: any) {
    return { success: true, data: await this.hrLetterService.getEmployeeLetters(employeeId, await this.actor(req)) };
  }

  @Get()
  @RequirePermission('hr-letters', 'view')
  async queryLetters(@Query() query: QueryLetterDto, @Req() req: any) {
    return { success: true, ...(await this.hrLetterService.queryLetters(query, await this.actor(req))) };
  }

  // Live preview while filling the create form — nothing is saved.
  @Post('preview')
  @RequirePermission('hr-letters', 'add')
  async previewLetter(@Body() dto: PreviewLetterDto, @Req() req: any) {
    return { success: true, data: await this.hrLetterService.previewLetter(dto, await this.actor(req)) };
  }

  @Get(':id')
  @RequirePermission('hr-letters', 'view')
  async getLetterById(@Param('id') id: string, @Req() req: any) {
    return { success: true, data: await this.hrLetterService.getLetterById(id, await this.actor(req)) };
  }

  @Post()
  @RequirePermission('hr-letters', 'add')
  async createLetter(@Body() dto: CreateLetterDto, @Req() req: any, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    const data = await this.hrLetterService.createLetter(dto, await this.actor(req), { ip, userAgent });
    return { success: true, data, message: data.status === 'draft' ? 'Draft saved' : `Letter ${data.letterNumber} issued` };
  }

  @Put(':id')
  @RequirePermission('hr-letters', 'edit')
  async updateDraft(@Param('id') id: string, @Body() dto: UpdateDraftDto, @Req() req: any, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    const data = await this.hrLetterService.updateDraft(id, dto, await this.actor(req), { ip, userAgent });
    return { success: true, data, message: 'Draft updated' };
  }

  @Post(':id/issue')
  @RequirePermission('hr-letters', 'add')
  async issueDraft(@Param('id') id: string, @Req() req: any, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    const data = await this.hrLetterService.issueDraft(id, await this.actor(req), { ip, userAgent });
    return { success: true, data, message: `Letter ${data.letterNumber} issued` };
  }

  @Post(':id/reissue')
  @RequirePermission('hr-letters', 'edit')
  async reissueLetter(@Param('id') id: string, @Body() dto: ReissueLetterDto, @Req() req: any, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    const data = await this.hrLetterService.reissueLetter(id, dto, await this.actor(req), { ip, userAgent });
    return { success: true, data, message: `Version ${data.version} issued` };
  }

  @Post(':id/cancel')
  @RequirePermission('hr-letters', 'edit')
  async cancelLetter(@Param('id') id: string, @Body() dto: CancelLetterDto, @Req() req: any, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    const data = await this.hrLetterService.cancelLetter(id, dto.reason, await this.actor(req), { ip, userAgent });
    return { success: true, data, message: 'Letter cancelled' };
  }

  @Post(':id/audit')
  @RequirePermission('hr-letters', 'view')
  async logClientAction(@Param('id') id: string, @Body() dto: ClientAuditDto, @Req() req: any, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    await this.hrLetterService.logClientAction(id, dto.action, await this.actor(req), { ip, userAgent });
    return { success: true };
  }

  @Delete(':id')
  @RequirePermission('hr-letters', 'delete')
  async deleteLetter(@Param('id') id: string, @Req() req: any, @Ip() ip: string, @Headers('user-agent') userAgent: string) {
    return this.hrLetterService.deleteLetter(id, await this.actor(req), { ip, userAgent });
  }
}
