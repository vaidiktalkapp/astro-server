const mongoose = require('mongoose');
const fs = require('fs');

const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";

async function run() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB via Mongoose");
    const db = mongoose.connection.db;
    
    // Check May to June users
    const start = new Date('2026-05-01T00:00:00.000Z');
    const end = new Date('2026-06-30T23:59:59.999Z');
    
    const users = await db.collection('users').find({
      createdAt: { $gte: start, $lte: end }
    }).toArray();
    
    console.log(`Total users registered from May to June 2026: ${users.length}`);
    
    const start24 = new Date('2024-05-01T00:00:00.000Z');
    const end24 = new Date('2024-06-30T23:59:59.999Z');
    const users24 = await db.collection('users').find({
      createdAt: { $gte: start24, $lte: end24 }
    }).toArray();
    
    console.log(`Users in 2024: ${users24.length}`);

    const targetUsers = users.length > 0 ? users : users24;
    
    let talked = [];
    let notTalked = [];
    
    for (let u of targetUsers) {
      if (u.stats && u.stats.totalSessions > 0) {
        talked.push(u);
      } else {
        const callCount = await db.collection('call_transactions').countDocuments({ userId: u._id });
        if (callCount > 0) {
           talked.push(u);
        } else {
           notTalked.push(u);
        }
      }
    }
    
    console.log(`Talked: ${talked.length}, Not Talked: ${notTalked.length}`);
    
    // Create CSVs
    const formatCSV = (usersArr) => {
       let csv = "Name,Phone Number\n";
       for (const u of usersArr) {
          const name = u.name ? u.name.replace(/,/g, '') : 'Unknown';
          const phone = u.phoneNumber || '';
          csv += `${name},${phone}\n`;
       }
       return csv;
    };

    fs.writeFileSync('users_talked_to_astrologer.csv', formatCSV(talked));
    fs.writeFileSync('users_not_talked_to_astrologer.csv', formatCSV(notTalked));
    
    console.log("CSV files created successfully.");
  } catch(e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
}

run();
