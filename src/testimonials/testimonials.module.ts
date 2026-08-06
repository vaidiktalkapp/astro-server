import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Testimonial, TestimonialSchema } from './schemas/testimonial.schema';
import { TestimonialsController } from './testimonials.controller';
import { TestimonialsService } from './testimonials.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Testimonial.name, schema: TestimonialSchema }])
  ],
  controllers: [TestimonialsController],
  providers: [TestimonialsService],
  exports: [TestimonialsService]
})
export class TestimonialsModule {}
