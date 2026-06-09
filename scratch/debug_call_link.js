const mongoose = require('mongoose');

async function debugCallSession() {
  try {
    await mongoose.connect('mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk');
    console.log('Connected to MongoDB');

    const CallSession = mongoose.model('CallSession', new mongoose.Schema({}, { strict: false }), 'call_sessions');
    
    // Get the latest AI call
    const latestCall = await CallSession.findOne({ isAi: true }).sort({ createdAt: -1 }).lean();
    
    if (!latestCall) {
      console.log('No AI calls found');
      process.exit(0);
    }

    console.log('Latest AI Call Detail:');
    console.log(JSON.stringify(latestCall, null, 2));

    const AiProfile = mongoose.model('AiProfile', new mongoose.Schema({}, { strict: false }), 'ai_astrologer_profiles');
    const profile = await AiProfile.findById(latestCall.astrologerId).lean();
    
    if (profile) {
      console.log('Found matching AI Profile:', profile.name);
    } else {
      console.log('WARNING: No AI Profile found for astrologerId:', latestCall.astrologerId);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugCallSession();
