import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

async function deleteAiTransactions() {
    dotenv.config({ path: path.join(__dirname, '../.env') });

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI not found in .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);
        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not established.');
        }

        console.log('✅ Connected to Database. Starting deletion of AI transactions...');

        // 1. Delete AI Wallet Transactions
        const regex = /AI Chat|AI Voice|AI Call/i;
        const walletResult = await db.collection('wallettransactions').deleteMany({
            description: { $regex: regex }
        });
        console.log(`🗑️ Deleted ${walletResult.deletedCount} AI transactions from 'wallettransactions'.`);

        // 2. Delete AI Call Sessions
        const callResult = await db.collection('call_sessions').deleteMany({
            isAi: true
        });
        console.log(`🗑️ Deleted ${callResult.deletedCount} AI call sessions from 'call_sessions'.`);

        console.log('✨ Cleanup complete!');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await mongoose.disconnect();
    }
}

deleteAiTransactions();
