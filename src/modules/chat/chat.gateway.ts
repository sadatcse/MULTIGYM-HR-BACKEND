import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { PresenceService } from './presence.service';

// Disabled: the production backend runs as a Vercel serverless function,
// which can't hold the persistent connections Socket.IO needs, so this is
// no longer registered as a @WebSocketGateway (no socket.io server is ever
// started). Kept as a plain injectable — `server` stays undefined forever —
// so TaskService/AccountabilityEventService/UnifiedReminderService/
// TaskReminderService's existing `chatGateway?.server?.emit(...)` calls
// keep compiling and safely no-op, and chat itself now runs over the plain
// REST endpoints in chat.controller.ts (see ChatSocketProvider.jsx on the
// frontend for the same reasoning). Re-decorate with @WebSocketGateway and
// wire this back into providers.jsx to bring real-time back on a host that
// supports long-lived connections.
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  server?: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
    private readonly presenceService: PresenceService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token as string;
      if (!token) throw new Error('Missing auth token');

      const payload = await this.jwtService.verifyAsync(token);
      const employeeId = payload.id as string;
      socket.data.employeeId = employeeId;

      // Personal room lets us target every tab/device of this employee with
      // server.to(employeeId) without tracking raw socket ids elsewhere.
      socket.join(employeeId);

      const justCameOnline = this.presenceService.addConnection(employeeId, socket.id);
      socket.emit('presence:list', { onlineEmployeeIds: this.presenceService.getOnlineEmployeeIds() });

      if (justCameOnline) {
        socket.broadcast.emit('presence:online', { employeeId });
      }
    } catch (err) {
      this.logger.warn(`Rejected chat socket connection: ${(err as Error).message}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const employeeId = socket.data?.employeeId as string | undefined;
    if (!employeeId) return;

    const wentOffline = this.presenceService.removeConnection(employeeId, socket.id);
    if (wentOffline) {
      socket.broadcast.emit('presence:offline', { employeeId });
    }
  }

  @SubscribeMessage('message:send')
  async handleMessageSend(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: { receiverId: string; content: string },
  ) {
    const senderId = socket.data.employeeId as string;
    const content = (dto?.content || '').trim();
    if (!content || !dto?.receiverId) {
      return { error: 'receiverId and content are required' };
    }

    const message = await this.chatService.sendMessage(senderId, dto.receiverId, content);

    // Receiver's tabs get it live; sender's OTHER tabs get it too so a
    // multi-tab session stays in sync (the originating tab also relies on
    // this same event rather than a separate ack, de-duping by _id).
    this.server?.to(dto.receiverId).emit('message:new', message);
    this.server?.to(senderId).emit('message:new', message);

    return message;
  }

  @SubscribeMessage('message:seen')
  async handleMessageSeen(@ConnectedSocket() socket: Socket, @MessageBody() dto: { partnerId: string }) {
    const userId = socket.data.employeeId as string;
    if (!dto?.partnerId) return { error: 'partnerId is required' };

    const result = await this.chatService.markSeen(userId, dto.partnerId);

    this.server?.to(dto.partnerId).emit('message:seen', {
      by: userId,
      conversationId: result.conversationId,
      seenAt: new Date(),
    });

    return result;
  }

  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() socket: Socket, @MessageBody() dto: { receiverId: string }) {
    const senderId = socket.data.employeeId as string;
    if (!dto?.receiverId) return;
    this.server?.to(dto.receiverId).emit('typing', { from: senderId });
  }
}
