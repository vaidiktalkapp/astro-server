const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const db = mongoose.connection.db;
    const call_sessions = db.collection('call_sessions');
    const ObjectId = mongoose.Types.ObjectId;
    
    let call = await call_sessions.findOne({ _id: new ObjectId('6a3d64e14509703870e7c38f') });
    
    if (call) {
        console.log('--- CALL DETAILS ---');
        console.log('ID:', call._id.toString());
        console.log('Session ID:', call.sessionId);
        console.log('vapiCallId:', call.vapiCallId);
        console.log('Duration:', call.duration);
        console.log('Recording Duration:', call.recordingDuration);
        console.log('Cost:', call.totalCost);
        console.log('Per Min Charge:', call.perMinuteCharge);
        console.log('StartTime:', call.startTime);
        console.log('EndTime:', call.endTime);
        console.log('Status:', call.status);
    } else {
        console.log('Call not found!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
