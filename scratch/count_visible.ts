import mongoose from 'mongoose';

const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";

async function run() {
    await mongoose.connect(uri);
    try {
        const db = mongoose.connection.db;
        if (!db) return;

        const visibleInApp = await db.collection('astrologers').countDocuments({
            accountStatus: 'active',
            'profileCompletion.isComplete': true
        });

        console.log(`Number of astrologers visible on the User App: ${visibleInApp}`);

    } finally {
        await mongoose.disconnect();
    }
}

run().catch(console.dir);
