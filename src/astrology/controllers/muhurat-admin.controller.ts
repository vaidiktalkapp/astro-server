import { Controller, Post, Body, Get, Param, Delete, UseGuards, Query, Patch, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MuhuratCategory, MuhuratCategoryDocument } from '../schemas/muhurat-category.schema';
import { MuhuratManualDate, MuhuratManualDateDocument } from '../schemas/muhurat-date.schema';
import { CreateMuhuratCategoryDto } from '../dto/create-muhurat-category.dto';
import { CreateMuhuratDateDto } from '../dto/create-muhurat-date.dto';
import { AdminAuthGuard } from '../../admin/core/guards/admin-auth.guard';

@Controller('admin/muhurat')
@UseGuards(AdminAuthGuard)

export class MuhuratAdminController {
  private readonly logger = new Logger(MuhuratAdminController.name);

  constructor(
    @InjectModel(MuhuratCategory.name) private categoryModel: Model<MuhuratCategoryDocument>,
    @InjectModel(MuhuratManualDate.name) private dateModel: Model<MuhuratManualDateDocument>,
  ) {}

  // -------------------------------------------------------------------------
  // CATEGORIES
  // -------------------------------------------------------------------------

  @Get('categories')
  async getAllCategories() {
    try {
        const categories = await this.categoryModel.find().sort({ name: 1 });
        return { success: true, data: categories };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('categories')
  async createCategory(@Body() dto: CreateMuhuratCategoryDto) {
    try {
        const category = await this.categoryModel.findOneAndUpdate(
            { slug: dto.slug },
            { $set: dto },
            { upsert: true, new: true }
        );
        return { success: true, data: category };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    try {
        const result = await this.categoryModel.findByIdAndDelete(id);
        if (!result) throw new Error('Category not found');
        return { success: true, message: 'Category deleted' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  // -------------------------------------------------------------------------
  // MANUAL DATES
  // -------------------------------------------------------------------------

  @Get('dates')
  async getAllDates(@Query('categoryId') categoryId?: string, @Query('month') month?: string) {
    try {
        this.logger.log(`Fetching manual dates for Category: ${categoryId || 'All'}, Month: ${month || 'All'}`);
        const filter: any = {};
        if (categoryId && categoryId !== 'all') filter.categoryId = categoryId;
        
        if (month) {
            // Month is likely YYYY-MM. We use a range $gte and $lte for reliable string comparison.
            const startOfMonth = `${month}-01`;
            const endOfMonth = `${month}-31`;
            filter.date = { $gte: startOfMonth, $lte: endOfMonth };
        }

        const dates = await this.dateModel.find(filter)
            .populate('categoryId')
            .sort({ date: 1 });
            
        this.logger.log(`Found ${dates.length} manual dates.`);
        return { success: true, data: dates };
    } catch (error: any) {
        this.logger.error(`Error fetching manual dates: ${error.message}`);
        return { success: false, message: error.message };
    }
  }

  @Post('dates')
  async createDate(@Body() dto: CreateMuhuratDateDto) {
    try {
        // Upsert based on category and date
        const date = await this.dateModel.findOneAndUpdate(
            { categoryId: dto.categoryId, date: dto.date },
            { $set: dto },
            { upsert: true, new: true }
        );
        return { success: true, data: date };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Delete('dates/:id')
  async deleteDate(@Param('id') id: string) {
    try {
        const result = await this.dateModel.findByIdAndDelete(id);
        if (!result) throw new Error('Date entry not found');
        return { success: true, message: 'Date entry deleted' };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }

  @Post('init-defaults')
  async initDefaults() {
    try {
        const defaults = [
            { name: 'Vivah (Marriage)', slug: 'marriage', icon: 'Heart', description: 'Find auspicious dates for wedding ceremonies and registrations.', isActive: true },
            { name: 'Griha Pravesh', slug: 'house-warming', icon: 'Home', description: 'Best times to enter a new home or perform house warming puja.', isActive: true },
            { name: 'Business / Shop', slug: 'business', icon: 'Briefcase', description: 'Auspicious timings to start a new business, shop, or office.', isActive: true },
            { name: 'Vehicle Purchase', slug: 'vehicle', icon: 'Car', description: 'Lucky dates to buy or take delivery of a new car or bike.', isActive: true },
            { name: 'Property Purchase', slug: 'property', icon: 'Building', description: 'Best times for property registration or signing land deals.', isActive: true },
            { name: 'Mundan / Ceremony', slug: 'ceremony', icon: 'Sparkles', description: 'Auspicious dates for Samskaras like Mundan or Upanayan.', isActive: true }
        ];

        const created: any[] = [];
        for (const item of defaults) {
            const cat = await this.categoryModel.findOneAndUpdate(
                { slug: item.slug },
                { $setOnInsert: item },
                { upsert: true, new: true }
            );
            created.push(cat);
        }

        return { success: true, message: `Initialized ${created.length} default categories`, data: created };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
  }
}
