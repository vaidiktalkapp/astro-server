const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://vadiktalk:7fnBvxiPrutuSu7G@ac-f2i86wa-shard-00-00.zjkqtzw.mongodb.net:27017,ac-f2i86wa-shard-00-01.zjkqtzw.mongodb.net:27017,ac-f2i86wa-shard-00-02.zjkqtzw.mongodb.net:27017/vaidiktalk?ssl=true&replicaSet=atlas-kbmjt8-shard-0&authSource=admin&appName=Cluster0');

  const astrologerSchema = new mongoose.Schema({
    displayOrder: Number,
    createdAt: Date,
    name: String
  }, { collection: 'astrologers', strict: false });

  const Astrologer = mongoose.model('Astrologer', astrologerSchema);

  // Reset all astrologers that have backfilled orders (any number) to 999999 (unassigned)
  const result = await Astrologer.updateMany({}, { $set: { displayOrder: 999999 } });
  console.log(`Reset ${result.modifiedCount} astrologers to 999999 (unassigned).`);

  console.log('Done!');
  process.exit(0);
}

run().catch(console.error);
