import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ChatMessageDocument = HydratedDocument<ChatMessage>;

@Schema({ timestamps: true, collection: 'chat_messages' })
export class ChatMessage {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true, index: true })
  sender: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Employee', required: true, index: true })
  receiver: Types.ObjectId;

  @Prop({ required: [true, 'Message content is required'], trim: true })
  content: string;

  // Deterministic id for the pair of participants: [smallerId, largerId].join('_')
  @Prop({ required: true, index: true })
  conversationId: string;

  @Prop({ default: false })
  seen: boolean;

  @Prop()
  seenAt?: Date;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);
ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });
