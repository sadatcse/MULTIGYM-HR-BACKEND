import { Controller, Get, Put, Body, HttpStatus, HttpCode, UseGuards } from '@nestjs/common';
import { SettingService } from './setting.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('setting')
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

  // Intentionally public (no guard): the login screen fetches company
  // branding (name/logo/contact) before a user is authenticated.
  @Get()
  async getSettings() {
    const data = await this.settingService.getSettings();
    return {
      statusCode: HttpStatus.OK,
      message: 'Site settings retrieved successfully',
      data,
    };
  }

  // The company logo as a data URL, for documents rendered in the browser
  // (PDF reports): the logo's storage host sends no CORS headers, so the page
  // can't read the image itself. Only ever fetches the logo saved in settings.
  @Get('logo')
  async getLogo() {
    const { logo } = await this.settingService.getSettings();
    let data: string | null = null;
    if (logo && /^https:\/\//.test(logo)) {
      try {
        const res = await (globalThis as any).fetch(logo, { signal: AbortSignal.timeout(8000) });
        const type = String(res.headers.get('content-type') || '');
        const bytes = Buffer.from(await res.arrayBuffer());
        if (res.ok && /^image\/(png|jpe?g|webp|gif|svg\+xml)/.test(type) && bytes.length <= 2 * 1024 * 1024) {
          data = `data:${type.split(';')[0]};base64,${bytes.toString('base64')}`;
        }
      } catch {
        data = null; // documents fall back to the company initials
      }
    }
    return { statusCode: HttpStatus.OK, data };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('settings', 'edit')
  async updateSettings(@Body() dto: UpdateSettingDto) {
    const data = await this.settingService.updateSettings(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Site settings updated successfully',
      data,
    };
  }
}
