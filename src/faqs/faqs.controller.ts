import { Controller, Get, Post, Body, Put, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { CreateFaqDto } from './dto/create-faq.dto';
// If you have JWT guard, you might want to uncomment this:
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('faqs')
export class FaqsController {
  constructor(private readonly faqsService: FaqsService) {}

  @Post()
  // @UseGuards(JwtAuthGuard) // Protect for admin only in production
  create(@Body() createFaqDto: CreateFaqDto) {
    return this.faqsService.create(createFaqDto);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.faqsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.faqsService.findOne(id);
  }

  @Put(':id')
  // @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateFaqDto: Partial<CreateFaqDto>) {
    return this.faqsService.update(id, updateFaqDto);
  }

  @Delete(':id')
  // @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.faqsService.remove(id);
  }
}
