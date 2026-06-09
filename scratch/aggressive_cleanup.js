const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const Astrologer = mongoose.model('Astrologer', new mongoose.Schema({}, { strict: false }));

    console.log('--- Starting AGGRESSIVE Global Astrologer Cleanup ---');

    // 1. Fix all blank/missing accountStatus to 'active'
    const statusResult = await Astrologer.updateMany(
      { $or: [{ accountStatus: '' }, { accountStatus: { $exists: false } }] },
      { $set: { accountStatus: 'active' } }
    );
    console.log(`Updated Status for ${statusResult.modifiedCount} accounts.`);

    // 2. Fix all incomplete profiles that HAVE pricing
    // We search for those with pricing > 0 and set them to complete
    const completionResult = await Astrologer.updateMany(
      { 
        $or: [
          { 'pricing.chat': { $gt: 0 } },
          { 'pricing.call': { $gt: 0 } }
        ]
      },
      { 
        $set: { 
          'profileCompletion.isComplete': true,
          'profileCompletion.steps.basicInfo': true,
          'profileCompletion.steps.expertise': true,
          'profileCompletion.steps.pricing': true,
          'profileCompletion.steps.availability': true,
          isChatEnabled: true,
          isCallEnabled: true,
          isLiveStreamEnabled: true
        } 
      }
    );
    console.log(`Updated Profile Completion for ${completionResult.modifiedCount} accounts.`);

    // Verify a target account
    const verified = await Astrologer.findOne({ name: /Praveen/i }).select('name accountStatus profileCompletion.isComplete');
    console.log('\nVerification (Acharya Praveen):', JSON.stringify(verified, null, 2));

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
}

run();
