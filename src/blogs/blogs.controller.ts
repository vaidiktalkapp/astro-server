import { Controller, Get, Post, Put, Delete, Body, Param, Query, Patch } from '@nestjs/common';
import { BlogsService } from './blogs.service';

@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  // ================= CATEGORIES =================
  @Post('categories')
  createCategory(@Body() data: any) {
    return this.blogsService.createCategory(data);
  }

  @Get('categories')
  getCategories(@Query('activeOnly') activeOnly: string) {
    return this.blogsService.findAllCategories(activeOnly === 'true');
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() data: any) {
    return this.blogsService.updateCategory(id, data);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.blogsService.deleteCategory(id);
  }

  // ================= BLOGS =================
  @Post()
  createBlog(@Body() data: any) {
    return this.blogsService.createBlog(data);
  }

  @Get()
  getBlogs(@Query() query: any) {
    return this.blogsService.findAllBlogs(query);
  }

  // Public endpoint to get by slug
  @Get('post/:slug')
  getBlogBySlug(@Param('slug') slug: string) {
    return this.blogsService.getBlogBySlug(slug);
  }

  // Admin endpoint to get by ID
  @Get(':id')
  getBlogById(@Param('id') id: string) {
    return this.blogsService.getBlogById(id);
  }

  @Put(':id')
  updateBlog(@Param('id') id: string, @Body() data: any) {
    return this.blogsService.updateBlog(id, data);
  }

  @Delete(':id')
  deleteBlog(@Param('id') id: string) {
    return this.blogsService.deleteBlog(id);
  }

  // Endpoint to increment views
  @Patch('post/:slug/view')
  incrementView(@Param('slug') slug: string) {
    this.blogsService.incrementViews(slug);
    return { success: true };
  }
}
