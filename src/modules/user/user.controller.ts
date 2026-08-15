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
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    // Record who attempted the login, even before we know if it succeeds
    res.locals.transactionMeta = { userEmail: dto.email || 'Unknown User' };

    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    res.locals.transactionMeta.userName = user.name;

    if (user.status === 'inactive') {
      throw new ForbiddenException('Account is inactive. Please contact support.');
    }

    const isMatch = await user.comparePassword(dto.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = await this.jwtService.signAsync(
      { id: user._id, role: user.role },
      { expiresIn: '24h' },
    );

    // Remove password field from user object before sending response
    const userResponse: any = user.toObject();
    delete userResponse.password;

    return { message: 'Login successful', user: userResponse, token };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(
    @Body() body: { email?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    // Tie the logout entry to the right user even if the x-user-email header wasn't sent
    if (body?.email) {
      res.locals.transactionMeta = { userEmail: body.email };
    }
    return { message: 'Logout successful' };
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    const userId = (req as any).user?.id;
    return this.userService.changePassword(userId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: Record<string, any>) {
    return this.userService.findAll(query);
  }

  @Get('get-id/:id')
  @UseGuards(JwtAuthGuard)
  findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Post('post')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Delete('delete/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Put('update/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(id, dto);
  }
}
