import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function migrateAiServices() {
    if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI not found in .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        if (!db) throw new Error("DB connection not established");
        const aiProfilesCollection = db.collection('ai_astrologer_profiles');

        const profiles = await aiProfilesCollection.find({}).toArray();
        console.log(`🔍 Found ${profiles.length} AI Astrologer profiles. migrating...`);

        let updatedCount = 0;

        for (const profile of profiles) {
            const updates: any = {};
            let needsUpdate = false;

            if (profile.isChatEnabled === undefined) {
                updates.isChatEnabled = true;
                needsUpdate = true;
            }
            if (profile.isCallEnabled === undefined) {
                updates.isCallEnabled = true;
                needsUpdate = true;
            }
            if (profile.chatRatePerMinute === undefined) {
                updates.chatRatePerMinute = profile.ratePerMinute || 0;
                needsUpdate = true;
            }
            if (profile.callRatePerMinute === undefined) {
                updates.callRatePerMinute = profile.ratePerMinute || 0;
                needsUpdate = true;
            }

            if (needsUpdate) {
                await aiProfilesCollection.updateOne(
                    { _id: profile._id },
                    { $set: updates }
                );
                updatedCount++;
                console.log(`✅ Updated profile ${profile.name} (${profile._id})`);
            }
        }

        console.log(`\n🎉 Migration complete. Updated ${updatedCount} profiles.`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

migrateAiServices();
