import { Controller, Get, HttpCode, HttpStatus, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ChatService } from './chat.service';
import { PresenceService } from './presence.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly presenceService: PresenceService,
  ) {}

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  async getConversations(@Req() req: Request) {
    const userId = (req as any).user.id;
    const data = await this.chatService.getConversations(userId);
    return { statusCode: HttpStatus.OK, message: 'Conversations retrieved successfully', data };
  }

  @Get('messages/:partnerId')
  @UseGuards(JwtAuthGuard)
  async getMessages(@Req() req: Request, @Param('partnerId') partnerId: string, @Query() query: Record<string, any>) {
    const userId = (req as any).user.id;
    const result = await this.chatService.getMessages(userId, partnerId, query);
    return { statusCode: HttpStatus.OK, message: 'Messages retrieved successfully', ...result };
  }

  @Put('messages/seen/:partnerId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async markSeen(@Req() req: Request, @Param('partnerId') partnerId: string) {
    const userId = (req as any).user.id;
    const data = await this.chatService.markSeen(userId, partnerId);
    return { statusCode: HttpStatus.OK, message: 'Messages marked as seen', data };
  }

  @Get('online')
  @UseGuards(JwtAuthGuard)
  getOnline() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Online employees retrieved successfully',
      data: this.presenceService.getOnlineEmployeeIds(),
    };
  }
}
