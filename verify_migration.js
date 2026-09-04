/**
 * Verify: Check babynames count in both DBs
 */
const { MongoClient } = require('mongodb');

const SOURCE_URI = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
const TARGET_URI = 'mongodb+srv://lokesh_db_user:CUEjn2BPvCeF6PXo@cluster0.75mbenf.mongodb.net/';

async function verify() {
  const sourceClient = new MongoClient(SOURCE_URI);
  const targetClient = new MongoClient(TARGET_URI);

  try {
    await sourceClient.connect();
    await targetClient.connect();

    const sourceDb = sourceClient.db('vaidiktalk');
    const targetDb = targetClient.db('vaidiktalk');

    // Check babynames specifically
    const sourceCount = await sourceDb.collection('babynames').countDocuments();
    const targetCount = await targetDb.collection('babynames').countDocuments();

    console.log('\n📊 VERIFICATION REPORT');
    console.log('==================================================');
    console.log(`babynames — Source: ${sourceCount}, Target: ${targetCount} ${sourceCount === targetCount ? '✅ MATCH' : '❌ MISMATCH'}`);

    // Also verify a few key collections
    const keyCollections = ['users', 'astrologers', 'chat_messages', 'wallettransactions', 'orders', 'notifications', 'call_sessions'];
    for (const col of keyCollections) {
      const src = await sourceDb.collection(col).countDocuments();
      const tgt = await targetDb.collection(col).countDocuments();
      console.log(`${col.padEnd(25)} — Source: ${String(src).padEnd(6)} Target: ${String(tgt).padEnd(6)} ${src === tgt ? '✅' : '❌ MISMATCH'}`);
    }
    console.log('==================================================\n');

  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

verify().catch(console.error);
