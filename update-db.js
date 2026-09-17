const mongoose = require('mongoose');

async function updateDb() {
  const MONGO_URI = 'mongodb+srv://vishx998:re%40XBRRg4_89MSX@cluster0.rmehimd.mongodb.net/vaidik_dump?appName=cluster0';
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // 1. Update FAQs collection
  const faqsCollection = db.collection('faqs');
  await faqsCollection.updateMany(
    { question: { $regex: /How long does it take to get my astrology report/i } },
    { $set: { answer: "<p>Most basic reports like Kundli are generated <strong>instantly</strong>.</p>" } }
  );
  console.log("Updated FAQs collection");

  // 2. Update Pujas collection FAQs array
  const pujasCollection = db.collection('pujas');
  const pujas = await pujasCollection.find({ "faqs.question": { $regex: /How long does it take to get my astrology report/i } }).toArray();
  for (const puja of pujas) {
      if (puja.faqs) {
          const updatedFaqs = puja.faqs.map(f => {
              if (f.question && f.question.match(/How long does it take to get my astrology report/i)) {
                  f.answer = "<p>Most basic reports like Kundli are generated <strong>instantly</strong>.</p>";
              }
              if (f.q && f.q.match(/How long does it take to get my astrology report/i)) {
                  f.a = "<p>Most basic reports like Kundli are generated <strong>instantly</strong>.</p>";
              }
              return f;
          });
          await pujasCollection.updateOne({ _id: puja._id }, { $set: { faqs: updatedFaqs } });
      }
  }
  console.log("Updated Pujas collection");

  // 3. Update Astrologers
  const astrosCollection = db.collection('astrologers');
  const astros = await astrosCollection.find({ 
      $or: [
          { bio: { $regex: /vaidik talk|catalyst/i } },
          { name: { $regex: /vaidik talk|catalyst/i } }
      ]
  }).toArray();
  for (const astro of astros) {
      let updatedBio = astro.bio;
      let updatedName = astro.name;
      if (updatedBio) {
          updatedBio = updatedBio.replace(/vaidik talk/gi, "AstroSolution").replace(/catalyst/gi, "AstroSolution");
      }
      if (updatedName) {
          updatedName = updatedName.replace(/vaidik talk/gi, "AstroSolution").replace(/catalyst/gi, "AstroSolution");
      }
      await astrosCollection.updateOne({ _id: astro._id }, { $set: { bio: updatedBio, name: updatedName } });
  }
  console.log("Updated Astrologers collection");

  process.exit(0);
}

updateDb().catch(console.error);
