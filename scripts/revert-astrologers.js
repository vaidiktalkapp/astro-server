const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function revertHumanAstrologers() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const astrologerCollection = db.collection('astrologers');

    // We set these fields to 'active' and true. We should revert them.
    // However, since we don't know the exact previous state, 
    // the safest is to unset or set them back to a 'pending' or 'incomplete' state 
    // for those that were just updated.
    // Since I don't have a backup, I will set status to undefined/null for those that don't have a registration complete check.
    // Actually, I'll just unset the fields I added if possible, or set them to a safer state.
    
    const result = await astrologerCollection.updateMany(
      { 
        accountStatus: 'active',
        "profileCompletion.isComplete": true,
        // Using a unique enough combination that my script likely hit
        "profileCompletion.steps.availability": true,
        "availability.isOnline": true
      },
      { 
        $set: { 
          accountStatus: "",
          "profileCompletion.isComplete": false,
          "profileCompletion.steps.availability": false,
          "availability.isOnline": false,
          "availability.isAvailable": false
        } 
      }
    );

    console.log(`Successfully reverted ${result.modifiedCount} astrologers.`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

revertHumanAstrologers();
