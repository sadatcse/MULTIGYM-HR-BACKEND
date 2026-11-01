import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { HrAccessService } from '../hr-config/hr-access.service';
import { GymAssetSetupService } from './gym-asset-setup.service';
import { GymAssetService } from './gym-asset.service';
import { GymAssetOpsService } from './gym-asset-ops.service';
import { GymAssetReportService } from './gym-asset-report.service';
import {
  CreateCategoryDto,
  CreateDisposalDto,
  CreateGymAssetDto,
  CreateLocationDto,
  CreateMaintenanceDto,
  CreatePlaceDto,
  CreateTransferDto,
  UpdateCategoryDto,
  UpdateDisposalDto,
  UpdateGymAssetDto,
  UpdateLocationDto,
  UpdateMaintenanceDto,
  UpdatePlaceDto,
} from './dto/gym-asset.dto';

// Permission keys match the Gym Assets entries in the frontend MenuItems.jsx.
// Locations and their places share the "gym-asset-locations" page.
const REGISTER = 'gym-assets';
const DETAILS = 'gym-asset-details';
const TRANSFERS = 'gym-asset-transfers';
const MAINTENANCE = 'gym-asset-maintenance';
const DISPOSALS = 'gym-asset-disposals';
const LOCATIONS = 'gym-asset-locations';

@Controller('gym-asset')
@UseGuards(JwtAuthGuard)
export class GymAssetController {
  constructor(
    private readonly setup: GymAssetSetupService,
    private readonly assets: GymAssetService,
    private readonly ops: GymAssetOpsService,
    private readonly reports: GymAssetReportService,
    private readonly access: HrAccessService,
  ) {}

  private actor(req: any) {
    return this.access.getActor(req.user);
  }

  // ---------------------------------------------------------------- locations
  // Lookup lists are open to signed-in users: every asset form needs them.
  @Get('locations')
  async locations(@Query() q: Record<string, any>) {
    return { success: true, data: await this.setup.listLocations(q) };
  }

  @Post('locations')
  @UseGuards(PermissionsGuard)
  @RequirePermission(LOCATIONS, 'add')
  async createLocation(@Body() dto: CreateLocationDto) {
    return { success: true, message: 'Location added', data: await this.setup.createLocation(dto) };
  }

  @Patch('locations/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(LOCATIONS, 'edit')
  async updateLocation(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return { success: true, message: 'Location updated', data: await this.setup.updateLocation(id, dto) };
  }

  @Delete('locations/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(LOCATIONS, 'delete')
  async removeLocation(@Param('id') id: string) {
    return { success: true, ...(await this.setup.removeLocation(id)) };
  }

  /** Names already used (responsible people, approvers, suppliers…) for form suggestions. */
  @Get('suggestions')
  async suggestions() {
    return { success: true, data: await this.setup.suggestions() };
  }

  // ---------------------------------------------------------------- places
  @Get('places')
  async places(@Query() q: Record<string, any>) {
    return { success: true, data: await this.setup.listPlaces(q) };
  }

  @Post('places')
  @UseGuards(PermissionsGuard)
  @RequirePermission(LOCATIONS, 'add')
  async createPlace(@Body() dto: CreatePlaceDto) {
    return { success: true, message: 'Place added', data: await this.setup.createPlace(dto) };
  }

  @Patch('places/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(LOCATIONS, 'edit')
  async updatePlace(@Param('id') id: string, @Body() dto: UpdatePlaceDto) {
    return { success: true, message: 'Place updated', data: await this.setup.updatePlace(id, dto) };
  }

  @Delete('places/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(LOCATIONS, 'delete')
  async removePlace(@Param('id') id: string) {
    return { success: true, ...(await this.setup.removePlace(id)) };
  }

  // ---------------------------------------------------------------- categories
  @Get('categories')
  async categories(@Query() q: Record<string, any>) {
    return { success: true, data: await this.setup.listCategories(q) };
  }

  @Post('categories')
  @UseGuards(PermissionsGuard)
  @RequirePermission('gym-asset-categories', 'add')
  async createCategory(@Body() dto: CreateCategoryDto) {
    return { success: true, message: 'Category added', data: await this.setup.createCategory(dto) };
  }

  @Patch('categories/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('gym-asset-categories', 'edit')
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return { success: true, message: 'Category updated', data: await this.setup.updateCategory(id, dto) };
  }

  @Delete('categories/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission('gym-asset-categories', 'delete')
  async removeCategory(@Param('id') id: string) {
    return { success: true, ...(await this.setup.removeCategory(id)) };
  }

  // ---------------------------------------------------------------- assets
  @Get('assets')
  @UseGuards(PermissionsGuard)
  @RequirePermission(REGISTER, 'view')
  async list(@Query() q: Record<string, any>) {
    return { success: true, ...(await this.assets.list(q)) };
  }

  @Get('assets/stats')
  @UseGuards(PermissionsGuard)
  @RequirePermission(REGISTER, 'view')
  async stats(@Query() q: Record<string, any>) {
    return { success: true, data: await this.assets.stats(q) };
  }

  @Get('assets/options')
  @UseGuards(PermissionsGuard)
  @RequirePermission([REGISTER, TRANSFERS, MAINTENANCE, DISPOSALS], 'view')
  async options(@Query() q: Record<string, any>) {
    return { success: true, data: await this.assets.options(q) };
  }

  @Get('assets/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission([REGISTER, DETAILS], 'view')
  async findOne(@Param('id') id: string) {
    return { success: true, data: await this.assets.findOne(id) };
  }

  @Get('assets/:id/history')
  @UseGuards(PermissionsGuard)
  @RequirePermission([REGISTER, DETAILS], 'view')
  async history(@Param('id') id: string, @Query() q: Record<string, any>) {
    return { success: true, ...(await this.assets.history(id, q)) };
  }

  @Post('assets')
  @UseGuards(PermissionsGuard)
  @RequirePermission(REGISTER, 'add')
  async create(@Body() dto: CreateGymAssetDto, @Req() req: any) {
    return { success: true, message: 'Asset added', data: await this.assets.create(dto, await this.actor(req)) };
  }

  @Patch('assets/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(REGISTER, 'edit')
  async update(@Param('id') id: string, @Body() dto: UpdateGymAssetDto, @Req() req: any) {
    return { success: true, message: 'Asset updated', data: await this.assets.update(id, dto, await this.actor(req)) };
  }

  @Delete('assets/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(REGISTER, 'delete')
  async remove(@Param('id') id: string, @Req() req: any) {
    return { success: true, ...(await this.assets.remove(id, await this.actor(req))) };
  }

  // ---------------------------------------------------------------- transfers
  @Get('transfers')
  @UseGuards(PermissionsGuard)
  @RequirePermission([TRANSFERS, REGISTER, DETAILS], 'view')
  async transfers(@Query() q: Record<string, any>) {
    return { success: true, ...(await this.ops.listTransfers(q)) };
  }

  @Get('transfers/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission([TRANSFERS, REGISTER, DETAILS], 'view')
  async transfer(@Param('id') id: string) {
    return { success: true, data: await this.ops.findTransfer(id) };
  }

  @Post('transfers')
  @UseGuards(PermissionsGuard)
  @RequirePermission(TRANSFERS, 'add')
  async createTransfer(@Body() dto: CreateTransferDto, @Req() req: any) {
    return { success: true, message: 'Asset transferred', data: await this.ops.createTransfer(dto, await this.actor(req)) };
  }

  // ---------------------------------------------------------------- maintenance
  @Get('maintenance')
  @UseGuards(PermissionsGuard)
  @RequirePermission([MAINTENANCE, REGISTER, DETAILS], 'view')
  async maintenance(@Query() q: Record<string, any>) {
    return { success: true, ...(await this.ops.listMaintenance(q)) };
  }

  @Post('maintenance')
  @UseGuards(PermissionsGuard)
  @RequirePermission(MAINTENANCE, 'add')
  async createMaintenance(@Body() dto: CreateMaintenanceDto, @Req() req: any) {
    return { success: true, message: 'Maintenance logged', data: await this.ops.createMaintenance(dto, await this.actor(req)) };
  }

  @Patch('maintenance/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(MAINTENANCE, 'edit')
  async updateMaintenance(@Param('id') id: string, @Body() dto: UpdateMaintenanceDto, @Req() req: any) {
    return { success: true, message: 'Maintenance updated', data: await this.ops.updateMaintenance(id, dto, await this.actor(req)) };
  }

  // ---------------------------------------------------------------- disposals
  @Get('disposals')
  @UseGuards(PermissionsGuard)
  @RequirePermission([DISPOSALS, REGISTER, DETAILS], 'view')
  async disposals(@Query() q: Record<string, any>) {
    return { success: true, ...(await this.ops.listDisposals(q)) };
  }

  @Post('disposals')
  @UseGuards(PermissionsGuard)
  @RequirePermission(DISPOSALS, 'add')
  async createDisposal(@Body() dto: CreateDisposalDto, @Req() req: any) {
    return { success: true, message: 'Asset disposed', data: await this.ops.createDisposal(dto, await this.actor(req)) };
  }

  @Patch('disposals/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(DISPOSALS, 'edit')
  async updateDisposal(@Param('id') id: string, @Body() dto: UpdateDisposalDto) {
    return { success: true, message: 'Disposal updated', data: await this.ops.updateDisposal(id, dto) };
  }

  // ---------------------------------------------------------------- reports
  @Get('reports/:type')
  @UseGuards(PermissionsGuard)
  @RequirePermission('gym-asset-reports', 'view')
  async report(@Param('type') type: string, @Query() q: Record<string, any>) {
    return { success: true, data: await this.reports.run(type, q) };
  }
}
