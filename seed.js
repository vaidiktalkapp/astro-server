const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/vaidik-talk';

mongoose.connect(url)
  .then(() => {
    console.log('Connected to MongoDB');
    seedData();
  })
  .catch(err => console.error('Connection error', err));

const celebSchema = new mongoose.Schema({
  name: String,
  slug: String,
  image: String,
  category: String,
  birthDate: String,
  birthTime: String,
  birthPlace: String,
  latitude: Number,
  longitude: Number,
  timezone: Number,
  summary: String,
  content: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Celebrity = mongoose.model('Celebrity', celebSchema);

async function seedData() {
  const data = [
    {
      name: "Virat Kohli",
      slug: "virat-kohli",
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Virat_Kohli_during_the_India_vs_Aus_4th_Test_match_at_Narendra_Modi_Stadium_on_09_March_2023.jpg/640px-Virat_Kohli_during_the_India_vs_Aus_4th_Test_match_at_Narendra_Modi_Stadium_on_09_March_2023.jpg",
      category: "Cricket",
      birthDate: "1988-11-05",
      birthTime: "10:28",
      birthPlace: "Delhi, India",
      latitude: 28.7041,
      longitude: 77.1025,
      timezone: 5.5,
      summary: "Indian international cricketer and former captain. Known for his aggressive batting and dedication.",
      content: "<p>Virat Kohli's horoscope shows immense drive, focus, and leadership capabilities. With strong Mars positions, he has the natural aggression required for competitive sports.</p>"
    },
    {
      name: "Amitabh Bachchan",
      slug: "amitabh-bachchan",
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Amitabh_Bachchan_in_2013.jpg/640px-Amitabh_Bachchan_in_2013.jpg",
      category: "Bollywood",
      birthDate: "1942-10-11",
      birthTime: "16:00",
      birthPlace: "Prayagraj, UP, India",
      latitude: 25.4358,
      longitude: 81.8463,
      timezone: 5.5,
      summary: "Legendary Indian actor, film producer, and television host.",
      content: "<p>An incredibly powerful sun sign mixed with deep artistic capability ensures long-lasting legacy and fame. His chart reflects tremendous resilience.</p>"
    },
    {
      name: "Narendra Modi",
      slug: "narendra-modi",
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Narendra_Modi_Official_Portrait_2022.jpg/640px-Narendra_Modi_Official_Portrait_2022.jpg",
      category: "Politician",
      birthDate: "1950-09-17",
      birthTime: "11:00",
      birthPlace: "Vadnagar, Gujarat, India",
      latitude: 23.7842,
      longitude: 72.6384,
      timezone: 5.5,
      summary: "Current Prime Minister of India.",
      content: "<p>The chart indicates strong political acumen and ability to connect with the masses, driven by an exceptional alignment of the major planets.</p>"
    },
    {
      name: "Priyanka Chopra",
      slug: "priyanka-chopra",
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Priyanka-chopra-gesf-2018-7565.jpg/640px-Priyanka-chopra-gesf-2018-7565.jpg",
      category: "Hollywood",
      birthDate: "1982-07-18",
      birthTime: "01:30",
      birthPlace: "Jamshedpur, Jharkhand, India",
      latitude: 22.8046,
      longitude: 86.2029,
      timezone: 5.5,
      summary: "Indian actress and producer, global icon.",
      content: "<p>Her dynamic astrological houses allow her to constantly reinvent herself and excel on an international stage.</p>"
    },
    {
      name: "Mukesh Ambani",
      slug: "mukesh-ambani",
      image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Mukesh_Ambani.jpg/640px-Mukesh_Ambani.jpg",
      category: "Businessman",
      birthDate: "1957-04-19",
      birthTime: "19:53",
      birthPlace: "Aden, Yemen",
      latitude: 12.8021,
      longitude: 44.9754,
      timezone: 3.0,
      summary: "Indian billionaire businessman, chairman of Reliance Industries.",
      content: "<p>With heavily fortified wealth-generating houses, his financial accumulation is historically profound, supported by highly auspicious yogas.</p>"
    }
  ];

  try {
    for (const item of data) {
      await Celebrity.findOneAndUpdate({ slug: item.slug }, item, { upsert: true, new: true });
    }
    console.log('Seeded ' + data.length + ' celebrities with improved images!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data', error);
    process.exit(1);
  }
}
