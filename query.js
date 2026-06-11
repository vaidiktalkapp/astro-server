const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk');
  console.log("Connected");
  
  const callSessionSchema = new mongoose.Schema({}, { strict: false });
  const CallSession = mongoose.model('CallSession', callSessionSchema, 'call_sessions');
  
  const session = await CallSession.findOne({ sessionId: 'AI_VOICE_1781200571404_383d90' }).lean();
  console.log(JSON.stringify(session, null, 2));
  process.exit(0);
}

check().catch(console.error);
