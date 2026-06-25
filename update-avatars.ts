import mongoose from 'mongoose';

mongoose.connect('mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk').then(async () => { 
  const db = mongoose.connection; 
  const reviews = db.collection('reviews'); 
  const zodiacs = [
    'https://vaidiktalk.s3.ap-south-1.amazonaws.com/images/row-1-column-1.png', 
    'https://vaidiktalk.s3.ap-south-1.amazonaws.com/images/row-1-column-2.png', 
    'https://vaidiktalk.s3.ap-south-1.amazonaws.com/images/row-1-column-3.png', 
    'https://vaidiktalk.s3.ap-south-1.amazonaws.com/images/row-2-column-1.png', 
    'https://vaidiktalk.s3.ap-south-1.amazonaws.com/images/row-2-column-2.png', 
    'https://vaidiktalk.s3.ap-south-1.amazonaws.com/images/row-2-column-3.png', 
    'https://vaidiktalk.s3.ap-south-1.amazonaws.com/images/row-3-column-1.png'
  ]; 
  
  const cursor = reviews.find({ testUserImage: { $regex: 'pravatar.cc' } }); 
  let count = 0;
  for await (const doc of cursor) { 
    const rIcon = zodiacs[Math.floor(Math.random() * zodiacs.length)]; 
    await reviews.updateOne({ _id: doc._id }, { $set: { testUserImage: rIcon } }); 
    count++;
  } 
  console.log(`Updated ${count} existing reviews!`); 
  process.exit(0); 
}).catch(console.error);
