const { MongoClient } = require('mongodb');

async function comprehensiveSecuritySweep() {
  const uri = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
  let client;
  try {
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db('vaidiktalk');
    
    console.log("🔍 Starting comprehensive security sweep...");

    // 1. Check for any backdoor admins
    console.log("\n--- Checking Admin Accounts ---");
    const admins = await db.collection('admins').find({}).toArray();
    for (const admin of admins) {
      console.log(`Admin Account: ${admin.email} (Role: ${admin.roleType || 'N/A'}, Created: ${admin.createdAt})`);
    }

    // 2. Deep scan all collections for hacker footprints
    console.log("\n--- Scanning all collections for hacker keywords ---");
    const collections = await db.listCollections().toArray();
    
    // The keywords from the defacement
    const keywords = [
      'lungzz',
      'proton.me',
      'НЕНАВИСТЬ',
      'DISGUSTING',
      '1788541470982', 
      '1788541134137',
      '2zl3wt',
      'c4mc32'
    ];
    
    const regex = new RegExp(`(${keywords.join('|')})`, 'i');
    
    let totalMatches = 0;
    
    for (const col of collections) {
      const collection = db.collection(col.name);
      const docs = await collection.find({}).toArray();
      
      for (const doc of docs) {
        const docString = JSON.stringify(doc);
        if (docString.match(regex)) {
           console.log(`⚠️ FOUND HACKER TRACE in collection [${col.name}], Doc ID: ${doc._id}`);
           totalMatches++;
        }
      }
    }
    
    if (totalMatches === 0) {
       console.log("✅ PERFECT! No hacker traces found anywhere in the database.");
    } else {
       console.log(`❌ Found ${totalMatches} remaining traces.`);
    }

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    if (client) await client.close();
  }
}

comprehensiveSecuritySweep();
