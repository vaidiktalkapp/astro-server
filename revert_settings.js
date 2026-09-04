const { MongoClient } = require('mongodb');

async function revertSettings() {
  const uri = "mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('vaidiktalk');
    const collection = database.collection('system_settings');
    
    await collection.updateOne({}, {
      $set: {
        promoBannerTitle: 'First Call/Chat FREE',
        promoBannerSubtitle: 'Consult Expert AI Astrologers',
        promoBannerCallText: 'Call Now',
        promoBannerChatText: 'Chat Now',
        promoBannerShowCall: true,
        promoBannerShowChat: true,
        promoBannerImage: '',
        isPromoBannerActive: true
      }
    });
    console.log("Reverted system_settings to safe defaults.");
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

revertSettings();
