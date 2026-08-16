import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessage.name) private readonly chatMessageModel: Model<ChatMessageDocument>,
  ) {}

  // Deterministic id for a pair of participants regardless of who initiates.
  buildConversationId(employeeIdA: string, employeeIdB: string): string {
    return [employeeIdA, employeeIdB].sort().join('_');
  }

  async sendMessage(senderId: string, receiverId: string, content: string) {
    const message = await this.chatMessageModel.create({
      sender: senderId,
      receiver: receiverId,
      content,
      conversationId: this.buildConversationId(senderId, receiverId),
    });
    return message.toObject();
  }

  async getMessages(userId: string, partnerId: string, query: Record<string, any>) {
    const conversationId = this.buildConversationId(userId, partnerId);
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 30;
    const skip = (page - 1) * limit;

    const [totalItems, messages] = await Promise.all([
      this.chatMessageModel.countDocuments({ conversationId }),
      this.chatMessageModel
        .find({ conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
    ]);

    return {
      data: messages.reverse(), // oldest-first for rendering
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    };
  }

  async markSeen(userId: string, partnerId: string) {
    const conversationId = this.buildConversationId(userId, partnerId);
    const result = await this.chatMessageModel.updateMany(
      { conversationId, receiver: userId, sender: partnerId, seen: false },
      { seen: true, seenAt: new Date() },
    );
    return { conversationId, modifiedCount: result.modifiedCount };
  }

  async getConversations(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const conversations = await this.chatMessageModel.aggregate([
      { $match: { $or: [{ sender: userObjectId }, { receiver: userObjectId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
        },
      },
      {
        $addFields: {
          partnerId: {
            $cond: [{ $eq: ['$lastMessage.sender', userObjectId] }, '$lastMessage.receiver', '$lastMessage.sender'],
          },
        },
      },
      {
        $lookup: {
          from: 'employees',
          localField: 'partnerId',
          foreignField: '_id',
          as: 'partner',
        },
      },
      { $unwind: '$partner' },
      {
        $lookup: {
          from: 'chat_messages',
          let: { conversationId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$conversationId'] },
                    { $eq: ['$receiver', userObjectId] },
                    { $eq: ['$seen', false] },
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'unread',
        },
      },
      {
        $project: {
          _id: 0,
          conversationId: '$_id',
          partner: {
            _id: '$partner._id',
            name: '$partner.name',
            email: '$partner.email',
            photo: '$partner.photo',
            role: '$partner.role',
            department: '$partner.department',
          },
          lastMessage: {
            _id: '$lastMessage._id',
            content: '$lastMessage.content',
            sender: '$lastMessage.sender',
            receiver: '$lastMessage.receiver',
            seen: '$lastMessage.seen',
            createdAt: '$lastMessage.createdAt',
          },
          unreadCount: { $ifNull: [{ $arrayElemAt: ['$unread.count', 0] }, 0] },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
    ]);

    return conversations;
  }
}
