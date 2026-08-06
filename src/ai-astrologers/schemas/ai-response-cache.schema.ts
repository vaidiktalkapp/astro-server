import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class AiResponseCache extends Document {
  @Prop({ required: true, index: true, unique: true })
  cacheKey: string;

  @Prop({ type: Object, required: true })
  data: any;

  @Prop({ required: true, index: true })
  expiresAt: Date;
}

export const AiResponseCacheSchema = SchemaFactory.createForClass(AiResponseCache);
AiResponseCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
