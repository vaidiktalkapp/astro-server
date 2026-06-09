import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AstrologyGuideDocument = AstrologyGuide & Document;

@Schema({ timestamps: true })
export class AstrologyGuide {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true, default: 1 })
  partNumber: number;

  @Prop({ default: 'Learn Astrology' })
  seriesTitle: string;

  @Prop({ required: true })
  content: string; // Rich HTML content from WYSIWYG editor

  @Prop()
  shortDescription: string;

  @Prop()
  featuredImage: string;

  @Prop()
  youtubeUrl: string; // Optional YouTube video link

  @Prop()
  hindiVersionUrl: string; // Optional link to Hindi version

  @Prop({ enum: ['Draft', 'Published', 'Archived'], default: 'Draft' })
  status: string;

  @Prop({ type: Date, default: Date.now })
  publishDate: Date;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const AstrologyGuideSchema = SchemaFactory.createForClass(AstrologyGuide);

// --- Planet Profile (Unchanged) ---

export type PlanetProfileDocument = PlanetProfile & Document;

@Schema({ timestamps: true })
export class PlanetProfile {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop()
  sanskritName: string;

  @Prop()
  symbol: string;

  @Prop()
  element: string;

  @Prop()
  significance: string;

  @Prop({ type: Map, of: String })
  quickFacts: Map<string, string>;

  @Prop([String])
  positiveTraits: string[];

  @Prop([String])
  negativeTraits: string[];

  @Prop([String])
  remedies: string[];

  @Prop()
  description: string;

  @Prop()
  imageUrl: string;

  @Prop({ enum: ['Draft', 'Published', 'Archived'], default: 'Published' })
  status: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const PlanetProfileSchema = SchemaFactory.createForClass(PlanetProfile);

// --- Moon Sign (Rashi) Profile ---

export type MoonSignProfileDocument = MoonSignProfile & Document;

@Schema({ timestamps: true })
export class MoonSignProfile {
    @Prop({ required: true, unique: true })
    name: string; // Aries, Taurus, etc.

    @Prop()
    sanskritName: string;

    @Prop()
    symbol: string; // The emoji/symbol

    @Prop()
    element: string; // Fire, Earth, etc.

    @Prop()
    quality: string; // Cardinal, Fixed, Mutable

    @Prop()
    rulingPlanet: string;

    @Prop()
    rulingPlanetSanskrit: string;

    @Prop()
    overview: string; // Rich HTML content

    @Prop({ type: [{ title: String, description: String, emoji: String }] })
    personalityTraits: { title: string; description: string; emoji: string }[];

    @Prop()
    emotionalNature: string; // Rich HTML content

    @Prop([String])
    strengths: string[];

    @Prop([String])
    weaknesses: string[];

    @Prop({
        type: {
            bestMatches: [String],
            goodMatches: [String],
            challengingMatches: [String]
        }
    })
    compatibility: {
        bestMatches: string[];
        goodMatches: string[];
        challengingMatches: string[];
    };

    @Prop({
        type: {
            color: String,
            number: String,
            day: String,
            gemstone: String,
            metal: String,
            direction: String
        }
    })
    luckyAttributes: {
        color: string;
        number: string;
        day: string;
        gemstone: string;
        metal: string;
        direction: string;
    };

    @Prop()
    moonMantra: string;

    @Prop()
    nakshatraInsight: string;

    @Prop({ enum: ['Draft', 'Published', 'Archived'], default: 'Published' })
    status: string;

    @Prop({ default: 0 })
    order: number;

    @Prop({ default: true })
    isActive: boolean;
}

export const MoonSignProfileSchema = SchemaFactory.createForClass(MoonSignProfile);
