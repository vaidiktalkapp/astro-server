const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Menu = mongoose.model('Menu', new mongoose.Schema({}, { strict: false }));
  const num = await Menu.find({ group: 'Premium Numerology' });
  const rep = await Menu.find({ group: 'Premium Reports' });
  for (let m of num) { await Menu.updateOne({ _id: m._id }, { $set: { order: m.order + 10 } }); }
  for (let m of rep) { await Menu.updateOne({ _id: m._id }, { $set: { order: m.order - 10 } }); }
  console.log('Swapped Kundli groups!');
  process.exit(0);
});
