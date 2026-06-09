const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vaidig-talk';

const HealingItemSchema = new mongoose.Schema({
  title: String,
  slug: { type: String, unique: true },
  type: String,
  content: String,
  shortDescription: String,
  featuredImage: String,
  youtubeUrl: String,
  metadata: Object,
  status: { type: String, default: 'Published' },
  order: Number,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

const HealingItem = mongoose.model('HealingItem', HealingItemSchema);

const MEDITATIONS = [
  {
    slug: 'inner-peace',
    title: 'Inner Peace & Calm',
    shortDescription: 'A soothing guide to disconnect from external noise and find your center.',
    content: '<h2>Finding Your Center</h2><p>This meditation is designed to help you reconnect with your inner stillness. In a world full of noise, taking 10 minutes to breathe and observe your thoughts without judgment can significantly reduce stress levels.</p><h3>Practice Instructions</h3><ol><li>Sit in a comfortable position.</li><li>Close your eyes softly.</li><li>Focus on the sensation of air entering your nostrils.</li><li>When your mind wanders, gently bring it back to the breath.</li></ol>',
    type: 'meditation',
    metadata: {
      duration: '10 min',
      focus: 'Stress Relief',
      benefits: ['Reduces anxiety', 'Lowers heart rate', 'Mental clarity'],
      color: 'bg-indigo-500',
    },
    order: 1
  },
  {
    slug: 'morning-vitality',
    title: 'Morning Energy Flow',
    shortDescription: 'Awaken your spirit and set a positive intention for the day ahead.',
    content: '<h2>Start Your Day Right</h2><p>Harness the power of the morning sun. This 5-minute session uses visualization to wake up your nervous system and clarify your goals for the day.</p>',
    type: 'meditation',
    metadata: {
      duration: '5 min',
      focus: 'Energy',
      benefits: ['Alertness', 'Motivation', 'Positive outlook'],
      color: 'bg-amber-500',
    },
    order: 2
  },
  {
    slug: 'deep-sleep',
    title: 'Restful Sleep',
    shortDescription: 'Prepare your mind and body for a deep, restorative night of rest.',
    content: '<h2>Preparing for Rest</h2><p>Scan your body from toes to head, releasing tension in each muscle group. Let go of the day\'s events and prepare for a healing sleep.</p>',
    type: 'meditation',
    metadata: {
      duration: '15 min',
      focus: 'Sleep',
      benefits: ['Faster sleep onset', 'Improved sleep quality', 'Body relaxation'],
      color: 'bg-slate-800',
    },
    order: 3
  },
];

const YOGA_POSES = [
  {
    slug: 'tadasana',
    title: 'Mountain Pose',
    shortDescription: 'The foundation of all standing poses, promoting groundedness.',
    content: '<h2>The Foundation: Tadasana</h2><p>Tadasana may look like just standing, but it is an active engagement of every muscle group to find perfect vertical alignment.</p>',
    type: 'yoga',
    metadata: {
      sanskritName: 'Tadasana',
      benefits: ['Improves posture', 'Strengthens thighs', 'Promotes stability'],
      difficulty: 'Beginner',
      category: 'Standing',
    },
    order: 1
  },
  {
    slug: 'adho-mukha',
    title: 'Downward Dog',
    shortDescription: 'A comprehensive stretch that energizes the entire body.',
    content: '<h2>Power and Stretch</h2><p>One of the most recognizable poses, Downward Dog builds upper body strength while stretching the entire back side of the body.</p>',
    type: 'yoga',
    metadata: {
      sanskritName: 'Adho Mukha Svanasana',
      benefits: ['Energizes the body', 'Stretches hamstrings', 'Calms the brain'],
      difficulty: 'Beginner',
      category: 'Inversion',
    },
    order: 2
  },
  {
    slug: 'vrikshasana',
    title: 'Tree Pose',
    shortDescription: 'A classic balancing pose to sharpen mental focus.',
    content: '<h2>Finding Balance</h2><p>Tree pose teaches us to be strong like a tree—rooted in the ground but flexible enough to sway with the wind.</p>',
    type: 'yoga',
    metadata: {
      sanskritName: 'Vrikshasana',
      benefits: ['Balance', 'Ankle strength', 'Mental focus'],
      difficulty: 'Intermediate',
      category: 'Balance',
    },
    order: 3
  },
];

const CRYSTALS = [
  {
    slug: 'amethyst',
    title: 'Amethyst',
    shortDescription: 'The stone of spiritual protection and purification.',
    content: '<h2>The Purple Guardian</h2><p>Amethyst is a powerful and protective stone. It guards against psychic attack, transmuting the energy into love and protecting the wearer from all types of harm.</p>',
    type: 'crystal',
    metadata: {
      color: 'Purple',
      chakra: 'Third Eye',
      element: 'Air',
      benefits: ['Intuition', 'Spiritual protection', 'Inner peace'],
    },
    order: 1
  },
  {
    slug: 'rose-quartz',
    title: 'Rose Quartz',
    shortDescription: 'The quintessential stone of love and compassion.',
    content: '<h2>Unconditional Love</h2><p>Rose Quartz is the stone of universal love. It restores trust and harmony in relationships, encouraging unconditional love.</p>',
    type: 'crystal',
    metadata: {
      color: 'Pink',
      chakra: 'Heart',
      element: 'Earth',
      benefits: ['Compassion', 'Healing', 'Emotional balance'],
    },
    order: 2
  },
];

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected!');

    const allItems = [...MEDITATIONS, ...YOGA_POSES, ...CRYSTALS];

    for (const item of allItems) {
      await HealingItem.updateOne(
        { slug: item.slug },
        { $set: item },
        { upsert: true }
      );
      console.log(`Seeded or Updated: ${item.title}`);
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
