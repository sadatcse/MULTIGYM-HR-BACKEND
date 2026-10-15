import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { LoginEmployeeDto } from './dto/login-employee.dto';
import { ChangePasswordEmployeeDto } from './dto/change-password-employee.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { HrAccessService } from '../hr-config/hr-access.service';

@Controller('employee')
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly jwtService: JwtService,
    private readonly access: HrAccessService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginEmployeeDto, @Res({ passthrough: true }) res: Response) {
    res.locals.transactionMeta = { userEmail: dto.email || 'Unknown Employee' };

    const employee = await this.employeeService.findByEmail(dto.email);
    if (!employee) {
      throw new UnauthorizedException('Invalid email or password');
    }

    res.locals.transactionMeta.userName = employee.name;

    if (employee.status === 'inactive') {
      throw new ForbiddenException('Account is inactive. Please contact support.');
    }

    const isMatch = await employee.comparePassword(dto.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = await this.jwtService.signAsync(
      { id: employee._id, role: employee.role },
      { expiresIn: '24h' },
    );

    const employeeResponse: any = employee.toObject();
    delete employeeResponse.password;

    return {
      message: 'Login successful',
      employee: employeeResponse,
      user: employeeResponse, // alias for frontend compatibility
      token,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body() body: { email?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (body?.email) {
      res.locals.transactionMeta = { userEmail: body.email };
    }
    return { message: 'Logout successful' };
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordEmployeeDto) {
    const employeeId = (req as any).user?.id || (req as any).employee?.id;
    return this.employeeService.changePassword(employeeId, dto);
  }

  // Scoped directory: management sees everyone, branch in-charges their own
  // branch(es), employees only themselves.
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query() query: Record<string, any>, @Req() req: Request) {
    const actor = await this.access.getActor((req as any).user);
    return this.employeeService.findAll(query, actor);
  }

  // Lightweight colleague list (name, ID, designation, branch, photo) for
  // pickers and chat — never includes personal or salary fields.
  @Get('directory')
  @UseGuards(JwtAuthGuard)
  directory(@Query('includeInactive') includeInactive?: string) {
    return this.employeeService.directory(includeInactive === 'true');
  }

  // Own profile for the signed-in employee (mobile app / profile page).
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return this.employeeService.findById((req as any).user?.id);
  }

  @Get('get-id/:id')
  @UseGuards(JwtAuthGuard)
  async findById(@Param('id') id: string, @Req() req: Request) {
    const actor = await this.access.getActor((req as any).user);
    return this.employeeService.findByIdFor(id, actor);
  }

  @Post('post')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('employee', 'add')
  async create(@Body() dto: CreateEmployeeDto, @Req() req: Request) {
    const actor = await this.access.getActor((req as any).user);
    await this.employeeService.assertCanWrite(actor, null, dto);
    return this.employeeService.create(dto, { id: actor.id, name: actor.name, role: actor.role });
  }

  @Delete('delete/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('employee', 'delete')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const actor = await this.access.getActor((req as any).user);
    await this.employeeService.assertCanDelete(actor, id);
    return this.employeeService.remove(id);
  }

  @Put('update/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('employee', 'edit')
  async update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto, @Req() req: Request) {
    const actor = await this.access.getActor((req as any).user);
    await this.employeeService.assertCanWrite(actor, id, dto);
    return this.employeeService.update(id, dto, { id: actor.id, name: actor.name, role: actor.role });
  }
}

// Controller alias mapped to @Controller('user') for complete route compatibility
@Controller('user')
export class UserController extends EmployeeController {}
