import { Controller, Get, Put, Body, HttpStatus, HttpCode } from '@nestjs/common';
import { SettingService } from './setting.service';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Controller('setting')
export class SettingController {
  constructor(private readonly settingService: SettingService) {}

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
  async updateSettings(@Body() dto: UpdateSettingDto) {
    const data = await this.settingService.updateSettings(dto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Site settings updated successfully',
      data,
    };
  }
}
