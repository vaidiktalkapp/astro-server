const { MongoClient } = require('mongodb');

async function restoreFromDump() {
  const sourceUri = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
  const dumpUri = 'mongodb+srv://vishx998:re%40XBRRg4_89MSX@cluster0.rmehimd.mongodb.net/vaidik_dump?appName=cluster0';

  let sourceClient, dumpClient;
  try {
    sourceClient = new MongoClient(sourceUri);
    dumpClient = new MongoClient(dumpUri);

    console.log("Connecting to dump DB...");
    await dumpClient.connect();
    console.log("Connected to dump DB!");

    console.log("Connecting to production DB...");
    await sourceClient.connect();
    console.log("Connected to production DB!");

    const sourceDb = sourceClient.db('vaidiktalk');
    const dumpDb = dumpClient.db('vaidik_dump');

    // 1. Restore system_settings (Promo Banner)
    const oldSystemSettings = await dumpDb.collection('system_settings').findOne({});
    if (oldSystemSettings) {
        console.log("Found old system_settings in dump:");
        const promoSettings = {
            promoBannerTitle: oldSystemSettings.promoBannerTitle,
            promoBannerSubtitle: oldSystemSettings.promoBannerSubtitle,
            promoBannerCallText: oldSystemSettings.promoBannerCallText,
            promoBannerChatText: oldSystemSettings.promoBannerChatText,
            promoBannerShowCall: oldSystemSettings.promoBannerShowCall,
            promoBannerShowChat: oldSystemSettings.promoBannerShowChat,
            promoBannerImage: oldSystemSettings.promoBannerImage,
            isPromoBannerActive: oldSystemSettings.isPromoBannerActive,
            promoBannerRedirectRoute: oldSystemSettings.promoBannerRedirectRoute
        };
        console.log(promoSettings);

        await sourceDb.collection('system_settings').updateOne({}, {
            $set: promoSettings
        });
        console.log("✅ Successfully restored system_settings (Promo Banner)!");
    } else {
        console.log("⚠️ No system_settings found in dump!");
    }

    // 2. Restore hero_settings (Hero Section)
    const oldHeroSettings = await dumpDb.collection('hero_settings').findOne({});
    if (oldHeroSettings) {
        console.log("Found old hero_settings in dump:");
        delete oldHeroSettings._id; // Remove _id before insertion
        console.log(oldHeroSettings);

        await sourceDb.collection('hero_settings').deleteMany({});
        await sourceDb.collection('hero_settings').insertOne(oldHeroSettings);
        console.log("✅ Successfully restored hero_settings (Hero Section)!");
    } else {
        console.log("⚠️ No hero_settings found in dump!");
    }

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    if (sourceClient) await sourceClient.close();
    if (dumpClient) await dumpClient.close();
  }
}

restoreFromDump();
