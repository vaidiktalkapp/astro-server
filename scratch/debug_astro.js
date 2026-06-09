const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    const Astrologer = mongoose.model('Astrologer', new mongoose.Schema({}, { strict: false }));

    const targetName = 'Acharya Praveen '; // Note the trailing space
    const astro = await Astrologer.findOne({ name: targetName });

    if (astro) {
      console.log(`--- Detailed Data for "${targetName}" ---`);
      console.log(JSON.stringify(astro, null, 2));
    } else {
      console.log(`Astrologer "${targetName}" not found.`);
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
}

run();
