import mongoose from 'mongoose';

const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";

async function run() {
    await mongoose.connect(uri);
    try {
        const db = mongoose.connection.db;
        if (!db) return;

        const totalActive = await db.collection('astrologers').countDocuments({ accountStatus: 'active' });
        const workingFine = await db.collection('astrologers').countDocuments({ accountStatus: 'active', 'profileCompletion.isComplete': true });
        const stuckIncomplete = await db.collection('astrologers').countDocuments({ accountStatus: 'active', 'profileCompletion.isComplete': false });
        
        // Breakdown of reasons for being incomplete among active ones
        const pricingMissing = await db.collection('astrologers').countDocuments({ accountStatus: 'active', 'profileCompletion.steps.pricing': false });
        const availabilityMissing = await db.collection('astrologers').countDocuments({ accountStatus: 'active', 'profileCompletion.steps.availability': false });
        
        console.log("=== ASTROLOGER STATUS REPORT ===");
        console.log(`Total Active Astrologers: ${totalActive}`);
        console.log(`Working Perfectly:        ${workingFine}`);
        console.log(`Stuck / Incomplete:       ${stuckIncomplete}`);
        console.log("--------------------------------");
        console.log("Reasons for Incompleteness (among active):");
        console.log(`Missing Pricing Setup:     ${pricingMissing}`);
        console.log(`Missing Availability:      ${availabilityMissing}`);

    } finally {
        await mongoose.disconnect();
    }
}

run().catch(console.dir);
