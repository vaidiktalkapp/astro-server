const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const PUJA_METADATA = {
  'rudrabhishek': {
    duration: '2-3 Hours', rating: '4.9', reviews: '412', benefits: ['Peace', 'Prosperity', 'Remove Obstacles']
  },
  'job-attract-confirm-puja': {
    duration: '2 Hours', rating: '4.8', reviews: '328', benefits: ['Career', 'Success', 'Wealth']
  },
  'dhan-laxmi-puja': {
    duration: '2 Hours', rating: '4.9', reviews: '530', benefits: ['Wealth', 'Abundance', 'Business']
  },
  'ganesh-ji-ko-laddoo-arpan': {
    duration: '1 Hour', rating: '4.9', reviews: '845', benefits: ['Remove Obstacles', 'Success', 'Beginnings']
  },
  'love-marriage-healing': {
    duration: '1.5 Hours', rating: '4.8', reviews: '215', benefits: ['Love', 'Marriage', 'Harmony']
  },
  'commitment-spell': {
    duration: '1.5 Hours', rating: '4.7', reviews: '189', benefits: ['Trust', 'Bond', 'Relationship']
  },
  'mangal-dosh-nivaran-puja': {
    duration: '3 Hours', rating: '4.9', reviews: '476', benefits: ['Marriage', 'Remove Dosh', 'Harmony']
  },
  'attract-your-love-spell': {
    duration: '1.5 Hours', rating: '4.8', reviews: '290', benefits: ['Love', 'Attraction', 'Romance']
  },
  'hanuman-sindoor-boondi-arpan': {
    duration: '1 Hour', rating: '4.9', reviews: '623', benefits: ['Strength', 'Courage', 'Protection']
  },
  'vishnu-sahasranamam-puja': {
    duration: '2 Hours', rating: '4.9', reviews: '342', benefits: ['Spiritual', 'Peace', 'Blessings']
  },
  'shani-tel-arpan-aarti': {
    duration: '1.5 Hours', rating: '4.8', reviews: '511', benefits: ['Remove Dosh', 'Protection', 'Relief']
  },
  'rahu-ketu-grah-shanti-puja': {
    duration: '2-3 Hours', rating: '4.8', reviews: '388', benefits: ['Mental Peace', 'Balance', 'Remove Obstacles']
  }
};

const pujaSchema = new mongoose.Schema({
  slug: { type: String, required: true },
  duration: String,
  rating: String,
  reviews: String,
  benefits: [String]
});

const Puja = mongoose.models.Puja || mongoose.model('Puja', pujaSchema);

async function update() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const [slug, meta] of Object.entries(PUJA_METADATA)) {
      const result = await Puja.updateOne(
        { slug },
        { $set: meta }
      );
      if (result.modifiedCount > 0) {
        console.log(`Updated metadata for: ${slug}`);
      } else {
        console.log(`No changes made for: ${slug} (maybe not found or already up to date)`);
      }
    }
    
    console.log('Update complete.');
    process.exit(0);
  } catch (error) {
    console.error('Update error:', error);
    process.exit(1);
  }
}

update();
