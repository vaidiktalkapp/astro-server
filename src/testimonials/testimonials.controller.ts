import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TestimonialsService } from './testimonials.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

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
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() createData: any) {
    return this.testimonialsService.create(createData);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.testimonialsService.update(id, updateData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string) {
    return this.testimonialsService.remove(id);
  }
}
