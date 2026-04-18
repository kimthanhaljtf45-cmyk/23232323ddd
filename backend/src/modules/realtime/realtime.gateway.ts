import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/ws',
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('RealtimeGateway');

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    const userId = client.handshake.auth?.userId;
    const role = client.handshake.auth?.role;

    if (!userId) {
      this.logger.warn('Client connected without userId, disconnecting');
      client.disconnect();
      return;
    }

    this.logger.log(`Client connected: ${client.id}, userId: ${userId}, role: ${role}`);

    // Join user-specific room
    client.join(`user:${userId}`);

    // Join role-specific room
    if (role) {
      client.join(`role:${role}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('thread.join')
  async joinThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { threadId: string },
  ) {
    client.join(`thread:${payload.threadId}`);
    this.logger.log(`Client ${client.id} joined thread: ${payload.threadId}`);
    return { ok: true };
  }

  @SubscribeMessage('thread.leave')
  async leaveThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { threadId: string },
  ) {
    client.leave(`thread:${payload.threadId}`);
    return { ok: true };
  }

  @SubscribeMessage('group.join')
  async joinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { groupId: string },
  ) {
    client.join(`group:${payload.groupId}`);
    this.logger.log(`Client ${client.id} joined group: ${payload.groupId}`);
    return { ok: true };
  }

  @SubscribeMessage('group.leave')
  async leaveGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { groupId: string },
  ) {
    client.leave(`group:${payload.groupId}`);
    return { ok: true };
  }

  // Emit methods for use by RealtimeEventsService
  emitToUser(userId: string, event: string, payload: any) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToThread(threadId: string, event: string, payload: any) {
    this.server.to(`thread:${threadId}`).emit(event, payload);
  }

  emitToGroup(groupId: string, event: string, payload: any) {
    this.server.to(`group:${groupId}`).emit(event, payload);
  }

  emitToRole(role: string, event: string, payload: any) {
    this.server.to(`role:${role}`).emit(event, payload);
  }

  broadcast(event: string, payload: any) {
    this.server.emit(event, payload);
  }
}
