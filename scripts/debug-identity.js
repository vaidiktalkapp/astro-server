
const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';

async function debug() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected!');

        const db = mongoose.connection.db;

        // 1. Get a sample AI session
        const session = await db.collection('chat_sessions').findOne({ orderId: /^AI-/ });
        console.log('\n--- Sample AI Session ---');
        console.log('ID:', session._id);
        console.log('orderId:', session.orderId);
        console.log('astrologerId:', session.astrologerId);
        console.log('astrologerModel:', session.astrologerModel);

        if (session.astrologerId) {
            // 2. Try to find the astrologer in the AI profiles collection
            const aiProfile = await db.collection('ai_astrologer_profiles').findOne({ _id: session.astrologerId });
            console.log('\n--- Linked AI Profile ---');
            if (aiProfile) {
                console.log('Name:', aiProfile.name);
                console.log('Image:', aiProfile.image);
            } else {
                console.log('❌ AI Profile NOT FOUND for this ID!');

                // 3. List some profiles to see what IDs exist
                const allProfiles = await db.collection('ai_astrologer_profiles').find().limit(5).toArray();
                console.log('\n--- Available AI Profiles ---');
                allProfiles.forEach(p => console.log(`ID: ${p._id}, Name: ${p.name}`));
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Debug failed:', error);
        process.exit(1);
    }
}

debug();
