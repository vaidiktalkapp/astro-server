const mongoose = require('mongoose');

async function main() {
    const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";
    
    try {
        await mongoose.connect(uri);
        const db = mongoose.connection.db;
        
        const settings = await db.collection('system_settings').findOne({});
        console.log(`\nWelcome Message Enabled in Settings: ${settings ? settings.isInteraktWelcomeEnabled : 'No Settings Found'}\n`);

        const users = await db.collection('users').find({}).sort({createdAt: -1}).limit(25).toArray();
        
        console.log("=== Last 25 Registered Users (Likely got Welcome Msg) ===");
        users.forEach((u, i) => {
            console.log(`${String(i+1).padStart(2, '0')}. ${u.name ? u.name.padEnd(20) : 'User'.padEnd(20)} | Phone: ${u.phoneNumber.padEnd(15)} | Joined: ${new Date(u.createdAt).toLocaleString('en-IN')}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}
main().catch(console.error);
