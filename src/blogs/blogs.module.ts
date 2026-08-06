import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlogsController } from './blogs.controller';
import { BlogsService } from './blogs.service';
import { Blog, BlogSchema } from './schemas/blog.schema';
import { BlogCategory, BlogCategorySchema } from './schemas/blog-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Blog.name, schema: BlogSchema },
      { name: BlogCategory.name, schema: BlogCategorySchema },
    ]),
  ],
  controllers: [BlogsController],
  providers: [BlogsService],
  exports: [BlogsService]
})
export class BlogsModule {}
