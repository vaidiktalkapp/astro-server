const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";

async function run() {
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    
    const start = new Date('2026-05-01T00:00:00.000Z');
    const end = new Date('2026-06-30T23:59:59.999Z');
    
    const users = await db.collection('users').find({
      createdAt: { $gte: start, $lte: end },
      status: { $ne: 'deleted' },
      name: { $not: /^Deleted User/i }
    }).toArray();
    
    const callUserIds = await db.collection('call_transactions').distinct('userId');
    const chatUserIds = await db.collection('chat_sessions').distinct('userId');
    const streamUserIds = await db.collection('stream_sessions').distinct('userId');
    
    const talkedSet = new Set([
      ...callUserIds.map(id => id.toString()),
      ...chatUserIds.map(id => id.toString()),
      ...streamUserIds.map(id => id.toString())
    ]);
    
    let talkedUsers = [];
    let notTalkedUsers = [];
    
    for (const u of users) {
      if (talkedSet.has(u._id.toString())) {
        talkedUsers.push(u);
      } else {
        notTalkedUsers.push(u);
      }
    }
    
    const formatCSV = (arr) => {
       let csv = "\uFEFFName,Phone Number\n";
       for (const u of arr) {
          const name = u.name ? u.name.replace(/,/g, ' ') : 'Unknown';
          const phone = u.phoneNumber || 'N/A';
          csv += `"${name}"," ${phone}"\n`; // space trick to prevent Excel scientific formatting
       }
       return csv;
    };
    
    const talkedPath = path.join(__dirname, '..', 'users_talked_to_astrologer.csv');
    const notTalkedPath = path.join(__dirname, '..', 'users_not_talked_to_astrologer.csv');
    
    fs.writeFileSync(talkedPath, formatCSV(talkedUsers));
    fs.writeFileSync(notTalkedPath, formatCSV(notTalkedUsers));
    
    // Clean up old files to avoid confusion
    const oldTalked = path.join(__dirname, '..', 'May_June_Talked_Users.csv');
    const oldNotTalked = path.join(__dirname, '..', 'May_June_Not_Talked_Users.csv');
    
    if (fs.existsSync(oldTalked)) fs.unlinkSync(oldTalked);
    if (fs.existsSync(oldNotTalked)) fs.unlinkSync(oldNotTalked);
    
    console.log("Files generated and old ones deleted.");
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
