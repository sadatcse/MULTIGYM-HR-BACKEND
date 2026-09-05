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
