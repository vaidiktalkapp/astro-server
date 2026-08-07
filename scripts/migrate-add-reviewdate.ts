import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || '';

async function migrate() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in environment variables');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected successfully.');

    const db = mongoose.connection.db;
    if (!db) {
        throw new Error('Database connection failed');
    }
    const collection = db.collection('reviews');

    console.log('Finding reviews without reviewDate...');
    const reviews = await collection.find({ reviewDate: { $exists: false } }).toArray();
    console.log(`Found ${reviews.length} reviews to migrate.`);

    let updatedCount = 0;
    for (const review of reviews) {
      const reviewDate = review.createdAt || new Date();
      await collection.updateOne(
        { _id: review._id },
        { $set: { reviewDate: reviewDate } }
      );
      updatedCount++;
      if (updatedCount % 100 === 0) {
        console.log(`Updated ${updatedCount} reviews...`);
      }
    }

    console.log(`✅ Migration complete. Successfully updated ${updatedCount} reviews.`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

migrate();
