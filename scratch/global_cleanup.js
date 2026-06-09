const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const Astrologer = mongoose.model('Astrologer', new mongoose.Schema({}, { strict: false }));

    console.log('--- Starting Global Astrologer Cleanup ---');

    // 1. Find all astrologers with pricing but marked as incomplete
    const astrologers = await Astrologer.find({ 
      $or: [
        { 'profileCompletion.isComplete': false },
        { accountStatus: '' },
        { accountStatus: { $exists: false } }
      ] 
    });

    console.log(`Found ${astrologers.length} astrologers to check.`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (let astro of astrologers) {
      const hasPricing = astro.pricing && (astro.pricing.chat > 0 || astro.pricing.call > 0);

      if (hasPricing) {
        // Fix status if blank
        if (!astro.accountStatus || astro.accountStatus === '') {
          astro.accountStatus = 'active';
        }

        // Force completion
        astro.profileCompletion = astro.profileCompletion || {};
        astro.profileCompletion.steps = astro.profileCompletion.steps || {};
        
        astro.profileCompletion.steps.basicInfo = true;
        astro.profileCompletion.steps.expertise = true;
        astro.profileCompletion.steps.pricing = true;
        astro.profileCompletion.steps.availability = true;
        astro.profileCompletion.isComplete = true;
        astro.profileCompletion.completedAt = astro.profileCompletion.completedAt || new Date();

        // Enable features
        astro.isChatEnabled = true;
        astro.isCallEnabled = true;
        astro.isLiveStreamEnabled = true;

        await astro.save();
        fixedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`\n--- Cleanup Finished ---`);
    console.log(`Fixed/Visible now: ${fixedCount}`);
    console.log(`Still incomplete (No Pricing): ${skippedCount}`);

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
}

run();
