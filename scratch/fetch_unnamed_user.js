const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const users = db.collection('users');
    
    const userByName = await users.findOne({ name: 'Unnamed User' });
    if (userByName) {
        console.log('User found by name:', JSON.stringify(userByName, null, 2));
    } else {
        const userByRegex = await users.findOne({ phone: { $regex: '7208577151' } });
        if (userByRegex) {
            console.log('User found by phone regex:', JSON.stringify(userByRegex, null, 2));
        } else {
            console.log('User still not found.');
        }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
