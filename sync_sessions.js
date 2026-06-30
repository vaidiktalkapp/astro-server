const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk?retryWrites=true&w=majority').then(async () => {
  const db = mongoose.connection.db;
  
  const astrologers = await db.collection('ai_astrologer_profiles').find().toArray();
  
  for (const astro of astrologers) {
      const sessionCount = await db.collection('chat_sessions').countDocuments({ astrologerId: astro._id });
      if (sessionCount !== astro.totalSessions) {
          console.log(`Updating ${astro.name}: ${astro.totalSessions} -> ${sessionCount}`);
          await db.collection('ai_astrologer_profiles').updateOne(
              { _id: astro._id },
              { $set: { totalSessions: sessionCount } }
          );
      }
  }
  
  console.log('Sync Complete.');
  process.exit(0);
});
