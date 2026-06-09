// scripts/migrate-commission-rate.ts
//
// One-time migration script to update all existing astrologers'
// platformCommissionRate from 40 to 50
//
// Usage: npx ts-node scripts/migrate-commission-rate.ts

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vaidik-talk';

const astrologerSchema = new mongoose.Schema({
    earnings: {
        platformCommissionRate: Number,
    },
}, { timestamps: true, strict: false });

const Astrologer = mongoose.model('Astrologer', astrologerSchema);

async function migrate() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // 1. Find all astrologers with the old commission rate (40)
        const oldRateCount = await Astrologer.countDocuments({
            'earnings.platformCommissionRate': 40,
        });
        console.log(`📊 Found ${oldRateCount} astrologers with 40% commission rate`);

        if (oldRateCount === 0) {
            console.log('ℹ️  No astrologers to update. All are already at the new rate.');
        } else {
            // 2. Update all astrologers from 40% to 50%
            const result = await Astrologer.updateMany(
                { 'earnings.platformCommissionRate': 40 },
                { $set: { 'earnings.platformCommissionRate': 50 } },
            );
            console.log(`✅ Updated ${result.modifiedCount} astrologers from 40% → 50%`);
        }

        // 3. Also update any astrologers that don't have the field set at all
        const noRateCount = await Astrologer.countDocuments({
            'earnings.platformCommissionRate': { $exists: false },
        });

        if (noRateCount > 0) {
            const result2 = await Astrologer.updateMany(
                { 'earnings.platformCommissionRate': { $exists: false } },
                { $set: { 'earnings.platformCommissionRate': 50 } },
            );
            console.log(`✅ Set commission rate for ${result2.modifiedCount} astrologers that had no rate`);
        }

        // 4. Verify
        const verifyCount = await Astrologer.countDocuments({
            'earnings.platformCommissionRate': 50,
        });
        const totalAstrologers = await Astrologer.countDocuments();
        console.log(`\n📊 Verification: ${verifyCount}/${totalAstrologers} astrologers now at 50%`);

        console.log('\n🎉 Migration complete!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
        process.exit(0);
    }
}

migrate();
