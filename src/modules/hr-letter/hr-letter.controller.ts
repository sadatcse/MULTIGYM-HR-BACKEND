import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { HrLetterService } from './hr-letter.service';
import { CreateLetterDto } from './dto/create-letter.dto';
import { ReissueLetterDto } from './dto/reissue-letter.dto';
import { QueryLetterDto } from './dto/query-letter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('hr-letters')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HrLetterController {
  constructor(private readonly hrLetterService: HrLetterService) {}

  @Get('stats')
  @RequirePermission('hr-letters', 'view')
  async getStats() {
    const data = await this.hrLetterService.getStats();
    return { success: true, data };
  }

  @Get('next-number')
  @RequirePermission('hr-letters', 'view')
  async getNextNumberPreview(@Query('letterType') letterType: string) {
    const data = await this.hrLetterService.getNextLetterNumberPreview(letterType || 'appointment');
    return { success: true, data: { nextLetterNumber: data } };
  }

  @Get('templates')
  @RequirePermission('hr-letters', 'view')
  async getAllTemplates() {
    const data = await this.hrLetterService.getAllTemplates();
    return { success: true, data };
  }

  @Get('templates/:type')
  @RequirePermission('hr-letters', 'view')
  async getTemplateForType(@Param('type') type: string) {
    const data = await this.hrLetterService.getTemplateForType(type);
    return { success: true, data };
  }

  @Put('templates/:id')
  @RequirePermission('hr-letters', 'edit')
  async updateTemplate(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const data = await this.hrLetterService.updateTemplate(id, body, req.user);
    return { success: true, data, message: 'Template updated successfully' };
  }

  @Get('audit-history')
  @RequirePermission('hr-letters', 'view')
  async getAuditHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const data = await this.hrLetterService.getAuditLogs(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
    return { success: true, ...data };
  }

  @Get('employee/:employeeId')
  @RequirePermission('hr-letters', 'view')
  async getEmployeeLetters(@Param('employeeId') employeeId: string) {
    const data = await this.hrLetterService.getEmployeeLetters(employeeId);
    return { success: true, data };
  }

  @Get()
  @RequirePermission('hr-letters', 'view')
  async queryLetters(@Query() query: QueryLetterDto) {
    const data = await this.hrLetterService.queryLetters(query);
    return { success: true, ...data };
  }

  @Get(':id')
  @RequirePermission('hr-letters', 'view')
  async getLetterById(@Param('id') id: string) {
    const data = await this.hrLetterService.getLetterById(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermission('hr-letters', 'add')
  async createLetter(
    @Body() dto: CreateLetterDto,
    @Req() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const data = await this.hrLetterService.createLetter(dto, req.user, { ip, userAgent });
    return { success: true, data, message: 'HR letter created successfully' };
  }

  @Post(':id/reissue')
  @RequirePermission('hr-letters', 'edit')
  async reissueLetter(
    @Param('id') id: string,
    @Body() dto: ReissueLetterDto,
    @Req() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const data = await this.hrLetterService.reissueLetter(id, dto, req.user, { ip, userAgent });
    return { success: true, data, message: 'HR letter reissued successfully as new version' };
  }

  @Post(':id/audit')
  @RequirePermission('hr-letters', 'view')
  async logClientAction(
    @Param('id') id: string,
    @Body('action') action: string,
    @Req() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const letter = await this.hrLetterService.getLetterById(id);
    if (letter?.letter) {
      await this.hrLetterService.logAction({
        letterId: letter.letter._id,
        letterNumber: letter.letter.letterNumber,
        employeeId: letter.letter.employeeId,
        employeeName: letter.letter.employeeName,
        action: action || 'viewed',
        performedBy: {
          id: req.user?.userId || req.user?._id,
          name: req.user?.name || req.user?.employeeName || 'Authorized HR',
          role: req.user?.role || 'admin',
        },
        ipAddress: ip,
        userAgent,
      });
    }
    return { success: true };
  }

  @Delete(':id')
  @RequirePermission('hr-letters', 'delete')
  async deleteLetter(
    @Param('id') id: string,
    @Req() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const data = await this.hrLetterService.deleteLetter(id, req.user, { ip, userAgent });
    return data;
  }
}
