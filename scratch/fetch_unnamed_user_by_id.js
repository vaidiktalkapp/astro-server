const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const users = db.collection('users');
    
    // Convert to array to use javascript filter on ID
    const allUsers = await users.find({}).toArray();
    const user = allUsers.find(u => u._id.toString().endsWith('ec668f'));
    
    if (user) {
        console.log('User found by ID ending with ec668f:');
        console.log(JSON.stringify(user, null, 2));
    } else {
        console.log('User not found by ID. Showing a few users with empty names:');
        const emptyNameUsers = await users.find({ $or: [{name: null}, {name: ""}, {name: {$exists: false}}] }).limit(2).toArray();
        console.log(JSON.stringify(emptyNameUsers, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
