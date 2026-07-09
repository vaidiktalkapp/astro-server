const mongoose = require('mongoose');

async function main() {
    const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";
    
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('system_settings'); 

        const updateResult = await collection.updateOne(
            {}, 
            { $set: { interaktWelcomeTemplateName: 'welcome_alert_1rs' } }
        );

        console.log(`✅ System settings updated. Matched: ${updateResult.matchedCount}, Modified: ${updateResult.modifiedCount}`);

        const settings = await collection.findOne({});
        console.log(`Current template in DB: ${settings.interaktWelcomeTemplateName}`);

    } catch (error) {
        console.error('❌ Error during process:', error);
    } finally {
        await mongoose.disconnect();
    }
}

main().catch(console.error);
