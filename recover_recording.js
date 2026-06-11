const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function recoverRecording() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    const sessionId = 'CALL_1781159580197_N4MH1';
    const orderId = 'ORD_1781159580198_WCSJX';
    const recordingUrl = 'https://vaidiktalk.s3.amazonaws.com/recordings/CALL1781159580197N4MH1/9676ac5e494acf0cc7aa3b87bfece040_channel_1781159628786_3EU0MC_0.mp4';
    const s3Key = 'recordings/CALL1781159580197N4MH1/9676ac5e494acf0cc7aa3b87bfece040_channel_1781159628786_3EU0MC_0.mp4';

    // 1. Update Call Session
    console.log('Updating call_sessions...');
    const sessionUpdate = await db.collection('call_sessions').updateOne(
      { sessionId: sessionId },
      { 
        $set: { 
          hasRecording: true,
          recordingUrl: recordingUrl,
          recordingS3Key: s3Key,
          recordingType: 'voice_note'
        } 
      }
    );
    console.log(`Call Session updated: ${sessionUpdate.modifiedCount}`);

    // 2. Update Order
    console.log('Updating orders...');
    const orderUpdate = await db.collection('orders').updateOne(
      { 
        orderId: orderId,
        'sessionHistory.sessionId': sessionId
      },
      { 
        $set: { 
          hasRecording: true,
          recordingType: 'voice_note',
          'sessionHistory.$.hasRecording': true,
          'sessionHistory.$.recordingUrl': recordingUrl,
          'sessionHistory.$.recordingS3Key': s3Key,
          'sessionHistory.$.recordingType': 'voice_note'
        } 
      }
    );
    console.log(`Order updated: ${orderUpdate.modifiedCount}`);

    console.log('✅ Recording successfully recovered and linked in the database!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

recoverRecording();
