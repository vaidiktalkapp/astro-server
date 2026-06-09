import mongoose from 'mongoose';

const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";

async function run() {
    await mongoose.connect(uri);
    try {
        const db = mongoose.connection.db;
        if (!db) return;

        const totalAstros = await db.collection('astrologers').countDocuments({});
        const statusBreakdown = await db.collection('astrologers').aggregate([
            { $group: { _id: '$accountStatus', count: { $sum: 1 } } }
        ]).toArray();
        
        const incompleteBreakdown = await db.collection('astrologers').aggregate([
            { $match: { 'profileCompletion.isComplete': false } },
            { $group: { _id: '$accountStatus', count: { $sum: 1 } } }
        ]).toArray();

        console.log("=== FULL ASTROLOGER AUDIT ===");
        console.log(`Grand Total in Database: ${totalAstros}`);
        console.log("--------------------------------");
        console.log("Breakdown by Account Status:");
        statusBreakdown.forEach(s => {
            console.log(`- ${s._id || 'none'}: ${s.count}`);
        });
        console.log("--------------------------------");
        console.log("Incomplete Profiles by Status:");
        incompleteBreakdown.forEach(s => {
            console.log(`- ${s._id || 'none'}: ${s.count}`);
        });

    } finally {
        await mongoose.disconnect();
    }
}

run().catch(console.dir);
