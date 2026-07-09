const mongoose = require('mongoose');

async function main() {
    const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";
    
    try {
        await mongoose.connect(uri);
        const db = mongoose.connection.db;
        const collection = db.collection('system_settings'); 
        
        const settings = await collection.findOne({});
        console.log(`Current template in DB: ${settings?.interaktWelcomeTemplateName || 'Not Set'}`);
        console.log(`isInteraktWelcomeEnabled: ${settings?.isInteraktWelcomeEnabled}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

main().catch(console.error);
