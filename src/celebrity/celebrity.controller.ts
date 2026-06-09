import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { CelebrityService } from './celebrity.service';
import { CreateCelebrityDto } from './dto/create-celebrity.dto';
import { AdminAuthGuard } from '../admin/core/guards/admin-auth.guard';

@Controller('celebrities')
export class CelebrityController {
  constructor(private readonly celebrityService: CelebrityService) {}

  // --- Public Routes ---

  @Get()
  findAll(@Query('category') category?: string) {
    const query = category ? { category, isActive: true } : { isActive: true };
    return this.celebrityService.findAll(query);
  }

  @Get('profile/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.celebrityService.findBySlug(slug);
  }

  // --- Admin Routes ---

  @UseGuards(AdminAuthGuard)
  @Post()
  create(@Body() createCelebrityDto: CreateCelebrityDto) {
    return this.celebrityService.create(createCelebrityDto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/all')
  findAllAdmin() {
    return this.celebrityService.findAll({});
  }

  @UseGuards(AdminAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.celebrityService.findOne(id);
  }

  @UseGuards(AdminAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: Partial<CreateCelebrityDto>) {
    return this.celebrityService.update(id, updateDto);
  }

  @UseGuards(AdminAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.celebrityService.remove(id);
  }
}
