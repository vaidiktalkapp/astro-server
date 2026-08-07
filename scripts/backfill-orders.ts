import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Astrologer, AstrologerDocument } from '../src/astrologers/schemas/astrologer.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const astrologerModel: Model<AstrologerDocument> = app.get(getModelToken(Astrologer.name));

  console.log('Starting backfill for display orders...');

  // Find all astrologers sorted by createdAt ascending
  const astrologers = await astrologerModel.find().sort({ createdAt: 1 }).exec();
  console.log(`Found ${astrologers.length} astrologers.`);

  for (let i = 0; i < astrologers.length; i++) {
    const astro = astrologers[i];
    const newOrder = i + 1;
    
    // We update them sequentially 1, 2, 3...
    await astrologerModel.updateOne({ _id: astro._id }, { $set: { displayOrder: newOrder } });
    console.log(`Updated astrologer ${astro.name} (${astro._id}) to order: ${newOrder}`);
  }

  console.log('Backfill complete!');
  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('Error during backfill:', err);
  process.exit(1);
});
