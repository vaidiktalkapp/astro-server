const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://vadiktalk:7fnBvxiPrutuSu7G@ac-f2i86wa-shard-00-00.zjkqtzw.mongodb.net:27017,ac-f2i86wa-shard-00-01.zjkqtzw.mongodb.net:27017,ac-f2i86wa-shard-00-02.zjkqtzw.mongodb.net:27017/vaidiktalk?ssl=true&replicaSet=atlas-kbmjt8-shard-0&authSource=admin&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const astrologerSchema = new mongoose.Schema({
    displayOrder: Number,
    createdAt: Date,
    name: String
  }, { collection: 'astrologers', strict: false });

  const Astrologer = mongoose.model('Astrologer', astrologerSchema);

  const astrologers = await Astrologer.find().sort({ createdAt: 1 }).exec();
  console.log(`Found ${astrologers.length} astrologers.`);

  for (let i = 0; i < astrologers.length; i++) {
    const astro = astrologers[i];
    const newOrder = i + 1;
    await Astrologer.updateOne({ _id: astro._id }, { $set: { displayOrder: newOrder } });
    console.log(`Updated astrologer ${astro.name} to order: ${newOrder}`);
  }

  console.log('Done!');
  process.exit(0);
}

run().catch(console.error);
