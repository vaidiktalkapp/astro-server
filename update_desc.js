const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const PUJA_SERVICES = [
  { id: 'rudrabhishek', desc: 'A sacred offering to Lord Shiva for inner peace, prosperity, protection, and removal of obstacles and negativity.' },
  { id: 'job-attract-confirm-puja', desc: 'A powerful puja to attract the right job opportunity, ensure success, and bring professional stability and growth.' },
  { id: 'dhan-laxmi-puja', desc: 'A prosperity-invoking ritual to seek the blessings of Goddess Laxmi for wealth and abundance.' },
  { id: 'ganesh-ji-ko-laddoo-arpan', desc: 'A sweet offering ritual to Lord Ganesha for removing obstacles and seeking blessings for new beginnings.' },
  { id: 'love-marriage-healing', desc: 'A divine healing ritual to restore love, strengthen relationships, and attract marital harmony through spiritual guidance.' },
  { id: 'commitment-spell', desc: 'Strengthen your bond and build lasting trust with a powerful Commitment Spell designed to deepen your relationship.' },
  { id: 'mangal-dosh-nivaran-puja', desc: 'A remedy ritual to reduce the ill effects of Mangal Dosh in one\'s horoscope and promote harmony in relationships.' },
  { id: 'attract-your-love-spell', desc: 'Manifest true affection and draw your desired partner closer with the powerful Attract Your Love Spell.' },
  { id: 'hanuman-sindoor-boondi-arpan', desc: 'A devotional offering to Lord Hanuman using sindoor and boondi to gain strength, courage, and protection.' },
  { id: 'vishnu-sahasranamam-puja', desc: 'The recitation of 1000 names of Lord Vishnu for spiritual upliftment, peace, and divine blessings.' },
  { id: 'shani-tel-arpan-aarti', desc: 'A traditional offering of oil to Lord Shani to reduce the impact of Shani Dosh and bring relief from obstacles.' },
  { id: 'rahu-ketu-grah-shanti-puja', desc: 'A ritual to pacify the malefic effects of Rahu and Ketu for mental peace and spiritual balance.' }
];

async function updateDesc() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Puja = mongoose.connection.collection('pujas');
  for (const p of PUJA_SERVICES) {
    await Puja.updateOne(
      { slug: p.id }, 
      { $set: { description: `<p>${p.desc}</p><br/><h3><strong>Key Benefits</strong></h3><ul><li>Removes negative energies and obstacles</li><li>Brings peace, prosperity, and harmony</li><li>Ensures divine protection and blessings</li></ul>` } }
    );
  }
  console.log('Descriptions updated');
  process.exit(0);
}
updateDesc();
