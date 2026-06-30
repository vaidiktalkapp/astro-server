const mongoose = require('mongoose');

async function main() {
    const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";
    try {
        await mongoose.connect(uri);
        const db = mongoose.connection.db;
        
        const getCollStats = async (collName) => {
            try {
                const stats = await db.command({ collStats: collName });
                return { count: stats.count, avgObjSize: stats.avgObjSize || 0 }; 
            } catch(e) {
                return { count: 0, avgObjSize: 0 };
            }
        };

        const users = await getCollStats('users');
        const astrologers = await getCollStats('astrologers');
        const transactions = await getCollStats('wallettransactions');
        const messages = await getCollStats('messages'); 

        const spaceLeftBytes = 486.27 * 1024 * 1024; // 486.27 MB in bytes
        
        console.log("=== AVERAGE SIZES (in Bytes) ===");
        console.log(`1 User Document: ~${users.avgObjSize} bytes`);
        console.log(`1 Wallet Transaction: ~${transactions.avgObjSize} bytes`);
        console.log(`1 Chat Message: ~${messages.avgObjSize} bytes`);
        
        console.log("\n=== HOW MUCH MORE YOU CAN STORE IN 486 MB ===");
        const formatNumber = (num) => num.toLocaleString('en-IN');

        if (users.avgObjSize > 0) {
            console.log(`- New Users: ~${formatNumber(Math.floor(spaceLeftBytes / users.avgObjSize))} users`);
        }
        if (transactions.avgObjSize > 0) {
            console.log(`- Wallet Transactions: ~${formatNumber(Math.floor(spaceLeftBytes / transactions.avgObjSize))} transactions`);
        }
        if (messages.avgObjSize > 0) {
            console.log(`- Chat Messages: ~${formatNumber(Math.floor(spaceLeftBytes / messages.avgObjSize))} messages`);
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
main();
