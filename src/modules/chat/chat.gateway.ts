import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { PresenceService } from './presence.service';

// Mirrors the CORS allow-list main.ts uses for the REST API — gateway CORS
// options are read by the decorator at class-definition time, before Nest's
// DI container exists, so this can't go through ConfigService like the rest
// of the app does; process.env is the only option here.
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [
  'http://localhost:3000',
  'http://localhost:3001',
];

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

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
    this.server.to(dto.receiverId).emit('message:new', message);
    this.server.to(senderId).emit('message:new', message);

    return message;
  }

  @SubscribeMessage('message:seen')
  async handleMessageSeen(@ConnectedSocket() socket: Socket, @MessageBody() dto: { partnerId: string }) {
    const userId = socket.data.employeeId as string;
    if (!dto?.partnerId) return { error: 'partnerId is required' };

    const result = await this.chatService.markSeen(userId, dto.partnerId);

    this.server.to(dto.partnerId).emit('message:seen', {
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
    this.server.to(dto.receiverId).emit('typing', { from: senderId });
  }
}
