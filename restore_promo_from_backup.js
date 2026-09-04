const { MongoClient } = require('mongodb');

async function restorePromoBanner() {
  const sourceUri = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
  const backupUri = 'mongodb+srv://lokesh_db_user:CUEjn2BPvCeF6PXo@cluster0.75mbenf.mongodb.net/';

  let sourceClient, backupClient;
  try {
    sourceClient = new MongoClient(sourceUri);
    backupClient = new MongoClient(backupUri);

    await sourceClient.connect();
    await backupClient.connect();

    const sourceDb = sourceClient.db('vaidiktalk');
    const backupDb = backupClient.db('vaidiktalk');

    // Get old settings from backup
    const oldSettings = await backupDb.collection('system_settings').findOne({});
    if (!oldSettings) {
        console.log("No settings found in backup!");
        return;
    }

    console.log("Found old promo settings in backup:");
    const oldPromoSettings = {
        promoBannerTitle: oldSettings.promoBannerTitle,
        promoBannerSubtitle: oldSettings.promoBannerSubtitle,
        promoBannerCallText: oldSettings.promoBannerCallText,
        promoBannerChatText: oldSettings.promoBannerChatText,
        promoBannerShowCall: oldSettings.promoBannerShowCall,
        promoBannerShowChat: oldSettings.promoBannerShowChat,
        promoBannerImage: oldSettings.promoBannerImage,
        isPromoBannerActive: oldSettings.isPromoBannerActive,
        promoBannerRedirectRoute: oldSettings.promoBannerRedirectRoute
    };
    
    console.log(oldPromoSettings);

    // Apply to production
    await sourceDb.collection('system_settings').updateOne({}, {
        $set: oldPromoSettings
    });

    console.log("Successfully restored old promo banner settings to production DB!");

  } catch (err) {
    console.error(err);
  } finally {
    if (sourceClient) await sourceClient.close();
    if (backupClient) await backupClient.close();
  }
}

restorePromoBanner();
