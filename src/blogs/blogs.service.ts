import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Blog } from './schemas/blog.schema';
import { BlogCategory } from './schemas/blog-category.schema';

@Injectable()
export class BlogsService {
  constructor(
    @InjectModel(Blog.name) private blogModel: Model<Blog>,
    @InjectModel(BlogCategory.name) private categoryModel: Model<BlogCategory>,
  ) {}

  // ================= CATEGORIES =================
  async createCategory(data: any): Promise<BlogCategory> {
    const category = new this.categoryModel(data);
    return category.save();
  }

  async findAllCategories(activeOnly: boolean = false): Promise<BlogCategory[]> {
    const filter = activeOnly ? { isActive: true } : {};
    return this.categoryModel.find(filter).sort({ name: 1 }).exec();
  }

  async updateCategory(id: string, data: any): Promise<BlogCategory> {
    const category = await this.categoryModel.findByIdAndUpdate(id, data, { new: true });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async deleteCategory(id: string): Promise<any> {
    const result = await this.categoryModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Category not found');
    return { success: true };
  }

  // ================= BLOGS =================
  async createBlog(data: any): Promise<Blog> {
    if (data.status === 'published' && !data.publishedAt) {
      data.publishedAt = new Date();
    }
    const blog = new this.blogModel(data);
    return blog.save();
  }

  async findAllBlogs(query: any): Promise<{ data: Blog[]; total: number }> {
    const { status, category, search, isFeatured, page = 1, limit = 10 } = query;
    const filter: any = {};
    
    if (status) filter.status = status;
    if (category) {
      if (Types.ObjectId.isValid(category)) {
        filter.category = category;
      } else {
        const catDoc = await this.categoryModel.findOne({ slug: category });
        filter.category = catDoc ? catDoc._id : new Types.ObjectId(); // use a dummy id if not found to return empty array
      }
    }
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === 'true';
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { seoKeywords: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      this.blogModel
        .find(filter)
        .populate('category', 'name slug')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.blogModel.countDocuments(filter)
    ]);

    return { data, total };
  }

  async getBlogBySlug(slug: string): Promise<Blog> {
    const blog = await this.blogModel
      .findOne({ slug, status: 'published' })
      .populate('category', 'name slug')
      .exec();
    
    if (!blog) throw new NotFoundException('Blog not found');
    return blog;
  }
  
  async getBlogById(id: string): Promise<Blog> {
    const blog = await this.blogModel.findById(id).populate('category', 'name slug').exec();
    if (!blog) throw new NotFoundException('Blog not found');
    return blog;
  }

  async updateBlog(id: string, data: any): Promise<Blog> {
    const current = await this.blogModel.findById(id);
    if (!current) throw new NotFoundException('Blog not found');

    if (data.status === 'published' && current.status !== 'published' && !current.publishedAt) {
      data.publishedAt = new Date();
    }

    const updatedBlog = await this.blogModel.findByIdAndUpdate(id, data, { new: true }).exec();
    if (!updatedBlog) throw new NotFoundException('Blog not found');
    return updatedBlog;
  }

  async deleteBlog(id: string): Promise<any> {
    const result = await this.blogModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Blog not found');
    return { success: true };
  }

  async incrementViews(slug: string): Promise<void> {
    await this.blogModel.updateOne(
      { slug },
      { $inc: { views: 1 } }
    );
  }
}
