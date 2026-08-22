import { IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class FaqDto {
  @IsString() @IsNotEmpty() q: string;
  @IsString() @IsNotEmpty() a: string;
}

class TestimonialDto {
  @IsString() name: string;
  @IsString() city: string;
  @IsString() date: string;
  @IsString() review: string;
  @IsString() initial: string;
  @IsString() color: string;
}

class VideoTestimonialDto {
  @IsString() youtubeId: string;
  @IsString() title: string;
}

class RelatedPujaDto {
  @IsString() title: string;
  @IsString() slug: string;
  @IsString() price: string;
  @IsString() img: string;
  @IsString() tag: string;
}

export class CreatePujaDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  shortDesc: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsOptional()
  @IsNumber()
  discountedPrice?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  wisdomCardTitle?: string;

  @IsOptional()
  @IsString()
  wisdomCardText?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsBoolean()
  popular?: boolean;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FaqDto)
  faqs?: FaqDto[];

  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsString()
  rating?: string;

  @IsOptional()
  @IsString()
  reviews?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  deity?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestimonialDto)
  testimonials?: TestimonialDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VideoTestimonialDto)
  videoTestimonials?: VideoTestimonialDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RelatedPujaDto)
  relatedPujas?: RelatedPujaDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gallery?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  processSteps?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  whyChooseUs?: string[];
}
