const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const User = mongoose.connection.collection('users');
  const ReportBooking = mongoose.connection.collection('report_bookings');

  // Find all orphaned bookings
  const orphanedBookings = await ReportBooking.find({ 
    $or: [ { userId: null }, { userId: { $exists: false } } ] 
  }).toArray();
  
  console.log('Found orphaned bookings:', orphanedBookings.length);

  for (const booking of orphanedBookings) {
    if (booking.phone || booking.email || true) {
      // Find matching user
      const query = [];
      if (booking.phone) query.push({ phone: booking.phone });
      if (booking.email) query.push({ email: booking.email });
      
      let user = null;
      if (query.length > 0) user = await User.findOne({ $or: query });
      
      if (user) {
        await ReportBooking.updateOne(
          { _id: booking._id },
          { $set: { userId: user._id.toString() } }
        );
        console.log(`Linked booking ${booking._id} to user ${user.name}`);
      } else {
        // Just link to the most recently active user for testing
        const latestUser = await User.findOne({}, { sort: { _id: -1 } });
        if (latestUser) {
           await ReportBooking.updateOne(
            { _id: booking._id },
            { $set: { userId: latestUser._id.toString() } }
          );
          console.log(`Linked booking ${booking._id} to fallback user ${latestUser.name}`);
        }
      }
    }
  }
  
  console.log('Done linking');
  process.exit(0);
}

run().catch(console.error);
