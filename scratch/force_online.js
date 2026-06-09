const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const astrologersCollection = db.collection('astrologers');

    const result = await astrologersCollection.updateOne(
      { email: 'divyachaurasiya199@gmail.com' },
      {
        $set: {
          'availability.isOnline': true,
          'availability.isAvailable': true,
          'availability.lastActive': new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('✅ Divya is now ONLINE in the database!');
      const updated = await astrologersCollection.findOne({ email: 'divyachaurasiya199@gmail.com' });
      console.log('Current availability status:', JSON.stringify(updated.availability, null, 2));
    } else {
      console.log('⚠️ Status was already online or astrologer not found.');
    }

  } catch (error) {
    console.error('❌ Error executing script:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
