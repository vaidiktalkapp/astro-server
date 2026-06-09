require('dotenv').config();
const mongoose = require('mongoose');

// Define Schema manually for the script
const ZodiacProfileSchema = new mongoose.Schema({
  sign: { type: String, required: true, unique: true },
  icon: { type: String, required: false },
  lovePersonality: { type: String, required: true },
  strengths: { type: [String], default: [] },
  weaknesses: { type: [String], default: [] },
  elementInfo: { type: String, required: true },
  compatibility: { type: [String], default: [] }
}, { timestamps: true });

// Use an existing model if compiled, otherwise compile it
const ZodiacProfile = mongoose.models.ZodiacProfile || mongoose.model('ZodiacProfile', ZodiacProfileSchema);

const profiles = [
  {
    sign: "Aries",
    icon: "♈",
    lovePersonality: "Aries rules love with fiery passion and unapologetic directness. In relationships, they are courageous, spontaneous, and fiercely protective. They crave a dynamic partnership filled with excitement, mutual challenge, and grand romantic gestures, making every moment feel like a thrilling adventure.",
    strengths: ["Passionate", "Spontaneous", "Protective", "Honest"],
    weaknesses: ["Impulsive", "Impatient", "Competitive", "Quick-tempered"],
    elementInfo: "Ruled by Mars and guided by Fire, Aries brings a fierce, pioneering energy to love, constantly igniting sparks and keeping the flame alive.",
    compatibility: ["Leo", "Sagittarius", "Gemini", "Aquarius"]
  },
  {
    sign: "Taurus",
    icon: "♉",
    lovePersonality: "Taurus seeks a love that is deeply rooted, sensual, and undeniably secure. They approach romance with patience and devotion, creating a sanctuary of comfort for their partner. For Taurus, love is expressed through physical touch, unwavering loyalty, and the shared enjoyment of life's finest luxuries.",
    strengths: ["Loyal", "Sensual", "Devoted", "Patient"],
    weaknesses: ["Stubborn", "Possessive", "Uncompromising", "Materialistic"],
    elementInfo: "Ruled by Venus and grounded by Earth, Taurus channels a steadfast, opulent energy, building a foundation of lasting romance and tactile pleasure.",
    compatibility: ["Virgo", "Capricorn", "Cancer", "Pisces"]
  },
  {
    sign: "Gemini",
    icon: "♊",
    lovePersonality: "Gemini experiences love through the meeting of minds. They are captivatingly charming, curious, and endlessly communicative. A fulfilling relationship for a Gemini requires constant mental stimulation, playful banter, and the freedom to explore the multifaceted layers of their emotional connection.",
    strengths: ["Communicative", "Adaptable", "Charming", "Intellectual"],
    weaknesses: ["Restless", "Inconsistent", "Indecisive", "Flirtatious"],
    elementInfo: "Ruled by Mercury and animated by Air, Gemini brings a breezy, communicative energy to romance, thriving on endless conversations and dual perspectives.",
    compatibility: ["Libra", "Aquarius", "Aries", "Leo"]
  },
  {
    sign: "Cancer",
    icon: "♋",
    lovePersonality: "Cancer offers a love that is profoundly nurturing, deeply intuitive, and unconditionally supportive. They seek to build a safe, emotionally rich harbor with their partner. Fiercely protective of their loved ones, they love with their entire soul and value emotional intimacy above all else.",
    strengths: ["Nurturing", "Intuitive", "Empathetic", "Protective"],
    weaknesses: ["Over-sensitive", "Moody", "Clingy", "Guarded"],
    elementInfo: "Ruled by the Moon and deep flowing Water, Cancer brings a tide of emotional depth, creating a sanctuary of warmth and emotional resonance.",
    compatibility: ["Scorpio", "Pisces", "Taurus", "Virgo"]
  },
  {
    sign: "Leo",
    icon: "♌",
    lovePersonality: "Leo loves with the brilliant, undeniable warmth of the sun. They are generous, theatrically romantic, and fiercely loyal. In a relationship, Leo wants to be adored and will, in return, treat their partner like royalty, showering them with affection, grand gestures, and undivided attention.",
    strengths: ["Generous", "Loyal", "Charismatic", "Warm-hearted"],
    weaknesses: ["Ego-driven", "Demanding", "Dramatic", "Possessive"],
    elementInfo: "Ruled by the Sun and ablaze with Fire, Leo commands a radiant, glorious presence in love, illuminating their partner's life with unshakeable devotion.",
    compatibility: ["Aries", "Sagittarius", "Gemini", "Libra"]
  },
  {
    sign: "Virgo",
    icon: "♍",
    lovePersonality: "Virgo expresses love through acts of service and meticulous care. They are entirely devoted, observant, and deeply practical. A Virgo's affection is shown not in grand, empty declarations, but in the quiet, consistent ways they make their partner's life better, smoother, and infinitely more beautiful.",
    strengths: ["Devoted", "Observant", "Helpful", "Reliable"],
    weaknesses: ["Overcritical", "Anxious", "Perfectionist", "Reserved"],
    elementInfo: "Ruled by Mercury and anchored in Earth, Virgo brings a pure, practical magic to relationships, carefully curating a stable and healing environment.",
    compatibility: ["Taurus", "Capricorn", "Cancer", "Scorpio"]
  },
  {
    sign: "Libra",
    icon: "♎",
    lovePersonality: "Libra is the ultimate romantic, seeking a love that is harmonious, beautiful, and perfectly balanced. They thrive in partnership and are willing to go to great lengths to ensure their relationship is peaceful and aesthetically pleasing. For Libra, love is an elegant dance of mutual respect and admiration.",
    strengths: ["Romantic", "Diplomatic", "Fair-minded", "Charming"],
    weaknesses: ["Indecisive", "Avoidant", "People-pleasing", "Superficial"],
    elementInfo: "Ruled by Venus and floating on Air, Libra brings an elegant, harmonious frequency to love, striving for the perfect equilibrium between two souls.",
    compatibility: ["Gemini", "Aquarius", "Leo", "Sagittarius"]
  },
  {
    sign: "Scorpio",
    icon: "♏",
    lovePersonality: "Scorpio loves with an intensity that transcends the physical realm. They seek a profound, almost psychic connection that merges two souls completely. A relationship with a Scorpio is transformative, deeply loyal, and built on unbreakable trust, demanding nothing less than absolute vulnerability.",
    strengths: ["Passionate", "Intensely loyal", "Intuitive", "Magnetic"],
    weaknesses: ["Jealous", "Secretive", "Vengeful", "Controlling"],
    elementInfo: "Ruled by Pluto and surging with Water, Scorpio channels a deep, oceanic intensity, inviting their partner into a profound crucible of emotional alchemy.",
    compatibility: ["Cancer", "Pisces", "Virgo", "Capricorn"]
  },
  {
    sign: "Sagittarius",
    icon: "♐",
    lovePersonality: "Sagittarius approaches love as the ultimate philosophical adventure. They are optimistic, wildly independent, and delightfully honest. In love, they need a co-pilot who is willing to explore the world, expand their horizons, and embrace a romance that is free from suffocating restrictions.",
    strengths: ["Optimistic", "Adventurous", "Honest", "Independent"],
    weaknesses: ["Commitment-phobic", "Tactless", "Restless", "Inconsistent"],
    elementInfo: "Ruled by Jupiter and driven by Fire, Sagittarius brings an expansive, spirited fire to love, turning every romantic encounter into a grand journey of discovery.",
    compatibility: ["Aries", "Leo", "Libra", "Aquarius"]
  },
  {
    sign: "Capricorn",
    icon: "♑",
    lovePersonality: "Capricorn takes love as seriously as they take everything else. They are looking for a powerful co-creator, someone to build an empire and a lasting legacy with. While they may appear reserved, a Capricorn's love is built on unwavering loyalty, deep devotion, and a foundation that can weather any storm.",
    strengths: ["Loyal", "Reliable", "Committed", "Ambitious"],
    weaknesses: ["Pessimistic", "Workaholic", "Unforgiving", "Guarded"],
    elementInfo: "Ruled by Saturn and rooted in Earth, Capricorn brings a structured, enduring strength to romance, promising a love that is built solidly to stand the test of time.",
    compatibility: ["Taurus", "Virgo", "Scorpio", "Pisces"]
  },
  {
    sign: "Aquarius",
    icon: "♒",
    lovePersonality: "Aquarius loves in a way that is distinctly unique, progressive, and deeply intellectual. They value friendship as the absolute foundation of any romantic partnership. An Aquarian seeks a partner who respects their absolute need for individuality while sharing their visionary ideals for the future.",
    strengths: ["Progressive", "Original", "Independent", "Intellectual"],
    weaknesses: ["Emotionally detached", "Unpredictable", "Stubborn", "Aloof"],
    elementInfo: "Ruled by Uranus and swirling through Air, Aquarius brings a visionary, electrifying energy to love, transcending traditional boundaries for a cosmic connection.",
    compatibility: ["Gemini", "Libra", "Aries", "Sagittarius"]
  },
  {
    sign: "Pisces",
    icon: "♓",
    lovePersonality: "Pisces is the quintessential dreamer of the zodiac, offering a love that is magically transcendent and spiritually profound. They love unconditionally, often merging their identity with their partner's. A relationship with a Pisces is a deep dive into an ocean of empathy, artistry, and boundless romantic devotion.",
    strengths: ["Empathetic", "Romantic", "Imaginative", "Compassionate"],
    weaknesses: ["Over-idealistic", "Escapist", "Overly trusting", "Martyr complex"],
    elementInfo: "Ruled by Neptune and lost in Water, Pisces brings a mystical, ethereal frequency to love, dissolving boundaries to create a truly spiritual union.",
    compatibility: ["Cancer", "Scorpio", "Taurus", "Capricorn"]
  }
];

// Determine the MongoDB URI
const MONGO_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/astrology_db';

async function seedZodiacProfiles() {
  try {
    console.log('Connecting to database...', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    console.log('Seeding 12 Western Zodiac Profiles...');
    for (const profile of profiles) {
      await ZodiacProfile.findOneAndUpdate(
        { sign: profile.sign },
        { $set: profile },
        { upsert: true, new: true }
      );
      console.log(`✓ Seeded ${profile.sign}`);
    }

    console.log('Successfully seeded all 12 Western Zodiac Profiles!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding Western Zodiac Profiles:', error);
    process.exit(1);
  }
}

seedZodiacProfiles();
