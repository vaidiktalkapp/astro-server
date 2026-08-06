const mongoose = require('mongoose');
const fs = require('fs');

mongoose.connect('mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk')
  .then(async () => {
    try {
      const db = mongoose.connection.db;
      
      const users = await db.collection('users').aggregate([
        {
          $match: {
            $expr: {
              $in: [{ $month: "$createdAt" }, [3, 4, 7]]
            }
          }
        },
        {
          $project: {
            name: 1,
            phoneNumber: 1,
            createdAt: 1,
            _id: 0
          }
        }
      ]).toArray();

      let csvContent = 'Name,Phone Number,Created At\n';
      users.forEach(user => {
        const name = user.name ? user.name.replace(/,/g, ' ') : 'Unknown';
        const phone = user.phoneNumber || 'Unknown';
        const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown';
        csvContent += `${name},${phone},${date}\n`;
      });

      fs.writeFileSync('March_April_July_Users.csv', csvContent);
      console.log('Successfully exported ' + users.length + ' users.');
      
    } catch (e) {
      console.error(e);
    } finally {
      process.exit(0);
    }
  });
