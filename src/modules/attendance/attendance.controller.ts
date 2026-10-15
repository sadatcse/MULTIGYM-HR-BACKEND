import { Body, Controller, Delete, ForbiddenException, Get, Headers, Ip, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { AttendanceService } from './attendance.service';
import { HrAccessService } from '../hr-config/hr-access.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { addDays, todayStr } from '../../common/helpers/hr-date.helper';

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly service: AttendanceService,
    private readonly access: HrAccessService,
  ) {}

  private actor(req: any) {
    return this.access.getActor(req.user);
  }

  // ---- Device push for a local sync agent (no JWT, shared key) ----------
  @Post('device-push')
  async devicePush(@Headers('x-device-key') key: string, @Body() body: { serialNumber?: string; punches: any[] }) {
    const cfg = await this.access.getConfig();
    const expected = Buffer.from(cfg.deviceApiKey || '');
    const given = Buffer.from(String(key || ''));
    if (!expected.length || expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new UnauthorizedException('Invalid device key');
    }
    if (!Array.isArray(body?.punches)) return { success: false, message: 'punches[] required' };
    let branch = '';
    if (body.serialNumber) {
      const device = await this.service.touchDevice(body.serialNumber);
      if (device && device.status !== 'active') throw new ForbiddenException('Device not approved');
      branch = device?.branch || '';
    }
    const result = await this.service.ingestPunches(
      body.punches.slice(0, 20000).map((p) => ({ deviceUserId: String(p.deviceUserId ?? p.userId ?? p.pin), time: p.time ?? p.timestamp, deviceSerial: body.serialNumber || '', branch, source: 'device' as const })),
    );
    return { success: true, ...result };
  }

  // ---- Employee self service -------------------------------------------
  @Get('my')
  @UseGuards(JwtAuthGuard)
  async my(@Query('month') month: string, @Req() req: any) {
    const actor = await this.actor(req);
    return { success: true, ...(await this.service.my(month, actor)) };
  }

  // ---- Daily board / records / reports --------------------------------
  @Get('daily')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance', 'view')
  async daily(@Query() query: any, @Req() req: any) {
    return { success: true, ...(await this.service.daily(query, await this.actor(req))) };
  }

  @Get('records')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance', 'view')
  async records(@Query() query: any, @Req() req: any) {
    return { success: true, data: await this.service.records(query, await this.actor(req)) };
  }

  @Get('monthly')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance-report', 'view')
  async monthly(@Query() query: any, @Req() req: any) {
    return { success: true, ...(await this.service.monthlyReport(query, await this.actor(req))) };
  }

  @Post('process')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance', 'edit')
  async process(@Body() body: { date?: string; branch?: string; force?: boolean; days?: number }, @Req() req: any) {
    const actor = await this.actor(req);
    if (actor.scope === 'self') throw new ForbiddenException('Not allowed');
    const branch = actor.scope === 'branch' ? body.branch && actor.branches.includes(body.branch) ? body.branch : actor.branches[0] : body.branch;
    const end = body.date || addDays(todayStr(), -1);
    const days = Math.min(31, Math.max(1, Number(body.days) || 1));
    const results: any[] = [];
    for (let i = days - 1; i >= 0; i--) {
      results.push(await this.service.processDate(addDays(end, -i), { branch, force: !!body.force && actor.scope === 'all' }));
    }
    return { success: true, data: results, message: `Processed ${results.reduce((s, r) => s + r.processed, 0)} employee-days` };
  }

  // ---- Corrections -----------------------------------------------------
  @Post('correct')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance', 'edit')
  async correct(@Body() body: any, @Req() req: any, @Ip() ip: string) {
    const data = await this.service.correct(body, await this.actor(req), (req.headers['x-user-ip'] as string) || ip);
    return { success: true, data, message: 'Attendance corrected and logged' };
  }

  @Post('records/:id/reset')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance', 'edit')
  async reset(@Param('id') id: string, @Body('reason') reason: string, @Req() req: any) {
    const data = await this.service.resetToDevice(id, reason, await this.actor(req));
    return { success: true, data, message: 'Record recalculated from device punches' };
  }

  @Get('corrections')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance-corrections', 'view')
  async corrections(@Query() query: any, @Req() req: any) {
    return { success: true, ...(await this.service.corrections(query, await this.actor(req))) };
  }

  // ---- Punches ---------------------------------------------------------
  @Get('punches')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance', 'view')
  async punches(@Query() query: any, @Req() req: any) {
    return { success: true, ...(await this.service.listPunches(query, await this.actor(req))) };
  }

  // Excel/CSV import of device logs: [{ deviceUserId, time: "YYYY-MM-DD HH:mm" }]
  @Post('punches/import')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance-devices', 'add')
  async importPunches(@Body() body: { punches: any[]; branch?: string }, @Req() req: any) {
    const actor = await this.actor(req);
    if (actor.scope !== 'all') throw new ForbiddenException('Only HR/management can import device logs');
    if (!Array.isArray(body?.punches)) return { success: false, message: 'punches[] required' };
    const result = await this.service.ingestPunches(
      body.punches.slice(0, 20000).map((p) => ({ deviceUserId: String(p.deviceUserId), time: p.time, branch: body.branch || '', source: 'import' as const })),
    );
    return { success: true, data: result, message: `${result.stored} new punches imported` };
  }

  @Post('punches/relink')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance-devices', 'edit')
  async relink() {
    return { success: true, data: await this.service.relinkUnmatched() };
  }

  // ---- Devices ---------------------------------------------------------
  @Get('devices')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance-devices', 'view')
  async devices() {
    return { success: true, data: await this.service.listDevices() };
  }

  @Post('devices')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance-devices', 'add')
  async addDevice(@Body() body: any) {
    return { success: true, data: await this.service.saveDevice(body), message: 'Device added' };
  }

  @Patch('devices/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance-devices', 'edit')
  async updateDevice(@Param('id') id: string, @Body() body: any) {
    return { success: true, data: await this.service.saveDevice(body, id), message: 'Device updated' };
  }

  @Delete('devices/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('attendance-devices', 'delete')
  async removeDevice(@Param('id') id: string) {
    return this.service.removeDevice(id);
  }
}
