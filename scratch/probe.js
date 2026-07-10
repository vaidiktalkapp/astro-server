const { MongoClient } = require('mongodb');
const fs = require('fs');

const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('vaidiktalk');
    
    // Check May to June users
    const start = new Date('2026-05-01T00:00:00.000Z');
    const end = new Date('2026-06-30T23:59:59.999Z');
    
    const users = await db.collection('users').find({
      createdAt: { $gte: start, $lte: end }
    }).toArray();
    
    console.log(`Total users registered from May to June: ${users.length}`);
    
    let talked = 0;
    let notTalked = 0;
    
    for (let u of users) {
      // check total sessions
      if (u.stats && u.stats.totalSessions > 0) {
        talked++;
      } else {
        // Double check in call_transactions?
        const callCount = await db.collection('call_transactions').countDocuments({ userId: u._id });
        if (callCount > 0) {
           talked++;
           // console.log(`User ${u._id} has no totalSessions but has call_transactions`);
        } else {
           notTalked++;
        }
      }
    }
    
    console.log(`Talked: ${talked}, Not Talked: ${notTalked}`);
    
    // Also check 2024 if 2026 has 0 users
    const start24 = new Date('2024-05-01T00:00:00.000Z');
    const end24 = new Date('2024-06-30T23:59:59.999Z');
    const users24 = await db.collection('users').countDocuments({
      createdAt: { $gte: start24, $lte: end24 }
    });
    console.log(`Users in 2024: ${users24}`);
    
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
