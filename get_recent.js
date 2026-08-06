const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function findSession() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const docs = await db.collection('orders').find({}).sort({createdAt: -1}).limit(20).toArray();
  
  console.log(`Last 20 orders:`);
  docs.forEach(doc => {
    console.log(`- ID: ${doc._id}, orderId: ${doc.orderId}, amount: ${doc.totalAmount}, dur: ${doc.actualDurationSeconds}, created: ${doc.createdAt}`);
    if (doc.sessionHistory) {
      doc.sessionHistory.forEach(sh => {
        console.log(`    Session: ${sh.sessionId}, dur: ${sh.duration}, url: ${sh.recordingUrl}`);
      });
    }
  });
  
  mongoose.disconnect();
}

findSession();
