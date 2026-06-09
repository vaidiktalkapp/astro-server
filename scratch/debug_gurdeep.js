const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const Astrologer = mongoose.model('Astrologer', new mongoose.Schema({}, { strict: false }));
    const Registration = mongoose.model('Registration', new mongoose.Schema({}, { strict: false }));

    const ticketId = 'AST-1777284897048-7HT0I9';
    const name = 'Astro Gurdeep Kaur';

    console.log(`--- Checking Registration for ${ticketId} ---`);
    const reg = await Registration.findOne({ ticketNumber: ticketId });
    console.log('Registration Data:', JSON.stringify(reg, null, 2));

    console.log(`\n--- Checking Astrologer for name "${name}" ---`);
    const astroByName = await Astrologer.findOne({ name: new RegExp(name, 'i') });
    console.log('Astrologer (by name):', JSON.stringify(astroByName, null, 2));

    if (reg && reg.phoneNumber) {
        console.log(`\n--- Checking Astrologer by phone ${reg.phoneNumber} ---`);
        const astroByPhone = await Astrologer.findOne({ phoneNumber: reg.phoneNumber });
        console.log('Astrologer (by phone):', JSON.stringify(astroByPhone, null, 2));
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error(err);
  }
}

run();
