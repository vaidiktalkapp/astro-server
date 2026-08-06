import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { TestimonialsService } from './testimonials.service';

@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  // Public endpoint to get active testimonials for the frontend
  @Get()
  findAllActive(@Query('category') category: string) {
    return this.testimonialsService.findAllActive(category);
  }

  // Admin endpoint to get all testimonials (including inactive)
  @Get('admin')
  findAllForAdmin(@Query('category') category: string) {
    return this.testimonialsService.findAllForAdmin(category);
  }

  @Post()
  create(@Body() createData: any) {
    return this.testimonialsService.create(createData);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.testimonialsService.update(id, updateData);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.testimonialsService.remove(id);
  }
}
