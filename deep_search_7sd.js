const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function findSession() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const cols = ['orders', 'callsessions', 'callhistories', 'users', 'astrologers'];
  let found = false;
  
  for (const col of cols) {
    try {
      // Dump recent documents to see if we can spot it
      const docs = await db.collection(col).find({}).sort({createdAt: -1}).limit(50).toArray();
      for (const doc of docs) {
        const json = JSON.stringify(doc);
        if (json.includes('7_SD') || json.includes('7SD')) {
          console.log(`Found match in ${col}! doc ID: ${doc._id}`);
          console.log('Doc details:', JSON.stringify(doc, null, 2));
          found = true;
          break;
        }
      }
      if(found) break;
    } catch(e) {}
  }
  
  if(!found) console.log('Not found in recent docs.');
  
  mongoose.disconnect();
}

findSession();
