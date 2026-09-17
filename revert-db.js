const mongoose = require('mongoose');

async function revertDb() {
  const MONGO_URI = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // 1. Revert FAQs collection
  const faqsCollection = db.collection('faqs');
  await faqsCollection.updateMany(
    { question: { $regex: /How long does it take to get my astrology report/i } },
    { $set: { answer: "<p>Most basic reports like Kundli are generated <strong>instantly</strong>. Detailed and manually personalized reports by our expert astrologers are delivered within <strong>24 hours</strong>.</p>" } }
  );
  console.log("Reverted FAQs collection");

  // 2. Revert Pujas collection FAQs array
  const pujasCollection = db.collection('pujas');
  const pujas = await pujasCollection.find({ "faqs.question": { $regex: /How long does it take to get my astrology report/i } }).toArray();
  for (const puja of pujas) {
      if (puja.faqs) {
          const updatedFaqs = puja.faqs.map(f => {
              if (f.question && f.question.match(/How long does it take to get my astrology report/i)) {
                  f.answer = "<p>Most basic reports like Kundli are generated <strong>instantly</strong>. Detailed and manually personalized reports by our expert astrologers are delivered within <strong>24 hours</strong>.</p>";
              }
              if (f.q && f.q.match(/How long does it take to get my astrology report/i)) {
                  f.a = "<p>Most basic reports like Kundli are generated <strong>instantly</strong>. Detailed and manually personalized reports by our expert astrologers are delivered within <strong>24 hours</strong>.</p>";
              }
              return f;
          });
          await pujasCollection.updateOne({ _id: puja._id }, { $set: { faqs: updatedFaqs } });
      }
  }
  console.log("Reverted Pujas collection");

  // 3. Revert Astrologers
  const astrosCollection = db.collection('astrologers');
  const astros = await astrosCollection.find({ 
      $or: [
          { bio: { $regex: /AstroSolution/i } },
          { name: { $regex: /AstroSolution/i } }
      ]
  }).toArray();
  for (const astro of astros) {
      let updatedBio = astro.bio;
      let updatedName = astro.name;
      if (updatedBio) {
          updatedBio = updatedBio.replace(/AstroSolution/gi, "Vaidik Talk");
      }
      if (updatedName) {
          updatedName = updatedName.replace(/AstroSolution/gi, "Vaidik Talk");
      }
      await astrosCollection.updateOne({ _id: astro._id }, { $set: { bio: updatedBio, name: updatedName } });
  }
  console.log("Reverted Astrologers collection");

  process.exit(0);
}

revertDb().catch(console.error);
