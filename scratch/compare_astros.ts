import mongoose from 'mongoose';

const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";

async function run() {
    await mongoose.connect(uri);
    try {
        const db = mongoose.connection.db;
        if (!db) return;

        // Find one working astrologer
        const workingAstro = await db.collection('astrologers').findOne({ 'profileCompletion.isComplete': true });
        console.log("Working Astrologer Example:", JSON.stringify(workingAstro?.profileCompletion, null, 2));

        // Find the broken one again to compare
        const brokenAstro = await db.collection('astrologers').findOne({ name: /Gurdeep/i });
        console.log("Broken Astrologer (Gurdeep):", JSON.stringify(brokenAstro?.profileCompletion, null, 2));

    } finally {
        await mongoose.disconnect();
    }
}

run().catch(console.dir);
