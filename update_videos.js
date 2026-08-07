const mongoose = require('mongoose');

async function run() {
  const uri = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    
    const realVideos = [
      {
        youtubeId: "https://youtube.com/shorts/_h8Ln2nRAxY?si=zSpUu9Rx6Ux2GbYt",
        title: "Devotee Review"
      },
      {
        youtubeId: "https://youtube.com/shorts/gbWzyzNObU0?si=ThiR5LLCh5m6_Yb1",
        title: "Vaidiktalk"
      },
      {
        youtubeId: "https://youtube.com/shorts/0LI8vBrIUf8?si=qyrHk_sx4lMhbuw2",
        title: "Vaidiktalk"
      }
    ];
    
    // Update all pujas to have these real videos
    const result = await db.collection('pujas').updateMany(
      {},
      { $set: { videoTestimonials: realVideos } }
    );
    
    console.log(`Updated ${result.modifiedCount} pujas with real videos.`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(console.dir);
