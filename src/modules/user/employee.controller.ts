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

@Controller('employee')
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly jwtService: JwtService,
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

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: Record<string, any>) {
    return this.employeeService.findAll(query);
  }

  @Get('get-id/:id')
  @UseGuards(JwtAuthGuard)
  findById(@Param('id') id: string) {
    return this.employeeService.findById(id);
  }

  @Post('post')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeeService.create(dto);
  }

  @Delete('delete/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.employeeService.remove(id);
  }

  @Put('update/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeeService.update(id, dto);
  }
}

// Controller alias mapped to @Controller('user') for complete route compatibility
@Controller('user')
export class UserController extends EmployeeController {}
