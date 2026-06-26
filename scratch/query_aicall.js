const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const ObjectId = mongoose.Types.ObjectId;
    let found = false;

    for (const colInfo of collections) {
      const collection = db.collection(colInfo.name);
      
      // Try exactly as ObjectId if it's a valid hex string of 24 chars
      let doc = await collection.findOne({ _id: new ObjectId('6a3d64e14509703870e7c38f') }).catch(()=>null);
      
      if (!doc) {
        doc = await collection.findOne({ 
            $or: [
                { sessionId: '6a3d64e14509703870e7c38f' },
                { callId: '6a3d64e14509703870e7c38f' }
            ]
        });
      }

      if (doc) {
        console.log(`Found in collection ${colInfo.name}:`, JSON.stringify(doc, null, 2));
        found = true;
      }
    }
    
    if (!found) {
        console.log("Not found in any collection by that ID.");
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected');
  }
}

run();
