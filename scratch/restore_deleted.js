const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const Astrologer = mongoose.model('Astrologer', new mongoose.Schema({}, { strict: false }));

    const result = await Astrologer.updateMany(
      { accountStatus: 'deleted' },
      { 
        $set: { 
          accountStatus: 'active', 
          'profileCompletion.isComplete': true, 
          'profileCompletion.steps.pricing': true, 
          'profileCompletion.steps.availability': true,
          isChatEnabled: true,
          isCallEnabled: true,
          isLiveStreamEnabled: true
        } 
      }
    );

    console.log(`Successfully restored ${result.modifiedCount} accounts from deleted to active.`);
    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
}

run();
