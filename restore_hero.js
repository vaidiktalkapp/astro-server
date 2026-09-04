const { MongoClient } = require('mongodb');

async function restoreHeroSettings() {
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
    const oldHeroSettings = await backupDb.collection('hero_settings').findOne({});
    if (!oldHeroSettings) {
        console.log("No hero settings found in backup!");
        return;
    }

    console.log("Found old hero settings in backup:");
    
    // Remove _id to avoid duplicate key errors during replacement
    delete oldHeroSettings._id;
    console.log(oldHeroSettings);

    // Apply to production
    await sourceDb.collection('hero_settings').deleteMany({});
    await sourceDb.collection('hero_settings').insertOne(oldHeroSettings);

    console.log("Successfully restored old hero settings to production DB!");

  } catch (err) {
    console.error(err);
  } finally {
    if (sourceClient) await sourceClient.close();
    if (backupClient) await backupClient.close();
  }
}

restoreHeroSettings();
