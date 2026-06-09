import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class DirectorySettings extends Document {
  @Prop({ type: [String], default: [] })
  cities: string[];

  @Prop({ type: [String], default: [] })
  popularCities: string[];

  @Prop({ type: [String], default: [] })
  expertise: string[];

  @Prop({ type: [String], default: [] })
  languages: string[];
  
  @Prop({ 
    type: [{ 
      city: String, 
      expertise: [String] 
    }], 
    default: [] 
  })
  cityExpertiseMap: { city: string; expertise: string[] }[];

  @Prop({ default: Date.now })
  updatedAt: Date;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const DirectorySettingsSchema = SchemaFactory.createForClass(DirectorySettings);
