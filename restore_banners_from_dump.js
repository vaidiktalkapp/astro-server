const { MongoClient } = require('mongodb');

async function restoreBannersFromDump() {
  const sourceUri = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
  const dumpUri = 'mongodb+srv://vishx998:re%40XBRRg4_89MSX@cluster0.rmehimd.mongodb.net/vaidik_dump?appName=cluster0';

  let sourceClient, dumpClient;
  try {
    sourceClient = new MongoClient(sourceUri);
    dumpClient = new MongoClient(dumpUri);

    console.log("Connecting to dump DB...");
    await dumpClient.connect();
    console.log("Connecting to production DB...");
    await sourceClient.connect();

    const sourceDb = sourceClient.db('vaidiktalk');
    const dumpDb = dumpClient.db('vaidik_dump');

    const oldBanners = await dumpDb.collection('banners').find({}).toArray();
    if (oldBanners && oldBanners.length > 0) {
        console.log(`Found ${oldBanners.length} banners in dump.`);
        
        await sourceDb.collection('banners').deleteMany({});
        await sourceDb.collection('banners').insertMany(oldBanners);
        console.log("✅ Successfully restored banners from dump!");
    } else {
        console.log("⚠️ No banners found in dump!");
    }

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    if (sourceClient) await sourceClient.close();
    if (dumpClient) await dumpClient.close();
  }
}

restoreBannersFromDump();
