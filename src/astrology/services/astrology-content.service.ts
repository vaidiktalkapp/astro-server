import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AstrologyGuide, AstrologyGuideDocument, PlanetProfile, PlanetProfileDocument, MoonSignProfile, MoonSignProfileDocument } from '../schemas/astrology-content.schema';

@Injectable()
export class AstrologyContentService {
  private readonly logger = new Logger(AstrologyContentService.name);

  constructor(
    @InjectModel(AstrologyGuide.name) private guideModel: Model<AstrologyGuideDocument>,
    @InjectModel(PlanetProfile.name) private planetModel: Model<PlanetProfileDocument>,
    @InjectModel(MoonSignProfile.name) private moonSignModel: Model<MoonSignProfileDocument>,
  ) {}

  // ==================== PUBLIC LESSON METHODS ====================

  async getLessons() {
    return await this.guideModel
      .find({ status: 'Published', isActive: true })
      .sort({ order: 1 })
      .select('title slug partNumber shortDescription order youtubeUrl hindiVersionUrl')
      .lean();
  }

  async getLessonBySlug(slug: string) {
    return await this.guideModel
      .findOne({ slug, status: 'Published', isActive: true })
      .lean();
  }

  async getAdjacentLessons(currentOrder: number) {
    const previous = await this.guideModel
      .findOne({ order: { $lt: currentOrder }, status: 'Published', isActive: true })
      .sort({ order: -1 })
      .select('title slug partNumber')
      .lean();

    const next = await this.guideModel
      .findOne({ order: { $gt: currentOrder }, status: 'Published', isActive: true })
      .sort({ order: 1 })
      .select('title slug partNumber')
      .lean();

    return { previous, next };
  }

  // ==================== PLANET METHODS (UNCHANGED) ====================

  async getPlanetProfiles() {
    return await this.planetModel.find({ status: 'Published', isActive: true }).sort({ name: 1 }).lean();
  }

  async getPlanetBySlug(slug: string) {
    return await this.planetModel.findOne({ slug, status: 'Published', isActive: true }).lean();
  }

  // ==================== ADMIN METHODS ====================

  async getAllLessonsAdmin() {
    return await this.guideModel.find().sort({ order: 1 }).lean();
  }

  async getAllPlanetsAdmin() {
    return await this.planetModel.find().sort({ name: 1 }).lean();
  }

  // ==================== MOON SIGN METHODS ====================

  async getMoonSignProfiles() {
    return await this.moonSignModel.find({ status: 'Published', isActive: true }).sort({ order: 1 }).lean();
  }

  async getMoonSignByName(name: string) {
    return await this.moonSignModel.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') }, 
        status: 'Published', 
        isActive: true 
    }).lean();
  }

  async getAllMoonSignsAdmin() {
    return await this.moonSignModel.find().sort({ order: 1 }).lean();
  }

  async upsertMoonSign(dto: any) {
    if (dto._id) {
       return await this.moonSignModel.findByIdAndUpdate(dto._id, { $set: dto }, { new: true });
    }
    return await this.moonSignModel.findOneAndUpdate(
      { name: dto.name },
      { $set: dto },
      { upsert: true, new: true }
    );
  }

  async deleteMoonSign(id: string) {
    return await this.moonSignModel.findByIdAndDelete(id);
  }

  async seedMoonSigns() {
    const signs = [
      { name: 'Aries', sanskritName: 'Mesha', symbol: '♈', element: 'Fire', quality: 'Cardinal', rulingPlanet: 'Mars', rulingPlanetSanskrit: 'Mangal', order: 1 },
      { name: 'Taurus', sanskritName: 'Vrishabha', symbol: '♉', element: 'Earth', quality: 'Fixed', rulingPlanet: 'Venus', rulingPlanetSanskrit: 'Shukra', order: 2 },
      { name: 'Gemini', sanskritName: 'Mithuna', symbol: '♊', element: 'Air', quality: 'Mutable', rulingPlanet: 'Mercury', rulingPlanetSanskrit: 'Budha', order: 3 },
      { name: 'Cancer', sanskritName: 'Karka', symbol: '♋', element: 'Water', quality: 'Cardinal', rulingPlanet: 'Moon', rulingPlanetSanskrit: 'Chandra', order: 4 },
      { name: 'Leo', sanskritName: 'Simha', symbol: '♌', element: 'Fire', quality: 'Fixed', rulingPlanet: 'Sun', rulingPlanetSanskrit: 'Surya', order: 5 },
      { name: 'Virgo', sanskritName: 'Kanya', symbol: '♍', element: 'Earth', quality: 'Mutable', rulingPlanet: 'Mercury', rulingPlanetSanskrit: 'Budha', order: 6 },
      { 
        name: 'Libra', 
        sanskritName: 'Tula', 
        symbol: '♎', 
        element: 'Air', 
        quality: 'Cardinal', 
        rulingPlanet: 'Venus', 
        rulingPlanetSanskrit: 'Shukra', 
        order: 7,
        moonMantra: 'Om Shukraya Namaha',
        strengths: ['Diplomatic', 'Charming', 'Aesthetic', 'Fair-minded', 'Socially adept', 'Balanced'],
        weaknesses: ['Indecisive', 'Avoids conflict', 'Overly idealistic', 'People-pleasing', 'Detached', 'Procrastination'],
        luckyAttributes: {
          color: 'Blue',
          number: '6',
          day: 'Friday',
          gemstone: 'Opal',
          metal: 'Copper',
          direction: 'West'
        },
        overview: 'Raja, with your Moon in Libra, you are driven by a deep need for balance and harmony. Your inner world is a tapestry of beauty and fairness, influenced by Shukra\'s grace.',
        nakshatraInsight: 'Your Nakshatra adds a layer of refinement and social grace to your Libra Moon.'
      },
      { name: 'Scorpio', sanskritName: 'Vrishchika', symbol: '♏', element: 'Water', quality: 'Fixed', rulingPlanet: 'Mars', rulingPlanetSanskrit: 'Mangal', order: 8 },
      { name: 'Sagittarius', sanskritName: 'Dhanu', symbol: '♐', element: 'Fire', quality: 'Mutable', rulingPlanet: 'Jupiter', rulingPlanetSanskrit: 'Guru', order: 9 },
      { name: 'Capricorn', sanskritName: 'Makara', symbol: '♑', element: 'Earth', quality: 'Cardinal', rulingPlanet: 'Saturn', rulingPlanetSanskrit: 'Shani', order: 10 },
      { name: 'Aquarius', sanskritName: 'Kumbha', symbol: '♒', element: 'Air', quality: 'Fixed', rulingPlanet: 'Saturn', rulingPlanetSanskrit: 'Shani', order: 11 },
      { name: 'Pisces', sanskritName: 'Meena', symbol: '♓', element: 'Water', quality: 'Mutable', rulingPlanet: 'Jupiter', rulingPlanetSanskrit: 'Guru', order: 12 },
    ];

    for (const sign of signs) {
      await this.moonSignModel.findOneAndUpdate(
        { name: sign.name },
        { $setOnInsert: { ...sign, status: 'Published', isActive: true } },
        { upsert: true }
      );
    }
    return { count: signs.length };
  }

  async upsertLesson(dto: any) {
    if (dto._id) {
      return await this.guideModel.findByIdAndUpdate(dto._id, { $set: dto }, { new: true });
    }
    return await this.guideModel.findOneAndUpdate(
      { slug: dto.slug },
      { $set: dto },
      { upsert: true, new: true }
    );
  }

  async upsertPlanet(dto: any) {
    if (dto._id) {
       return await this.planetModel.findByIdAndUpdate(dto._id, { $set: dto }, { new: true });
    }
    return await this.planetModel.findOneAndUpdate(
      { slug: dto.slug },
      { $set: dto },
      { upsert: true, new: true }
    );
  }

  async deleteLesson(id: string) {
    return await this.guideModel.findByIdAndDelete(id);
  }

  // ==================== SEED DATA ====================

  async seedInitialContent() {
    // --- Planet Data (unchanged) ---
    const planets = [
      {
        name: 'Sun', slug: 'sun', sanskritName: 'Surya', symbol: '☉', element: 'Fire', significance: 'Soul, Ego, Father, Authority',
        positiveTraits: ['Leadership', 'Confidence', 'Vitality', 'Dignity'], negativeTraits: ['Arrogance', 'Egoism', 'Domineering'],
        remedies: ['Offer water to the rising sun', 'Recite Aditya Hridaya Stotra'], description: 'Surya represents the soul, core identity, and life force. It is the king of the planetary cabinet.',
        status: 'Published', quickFacts: { 'Rules': 'Leo', 'Exalted': 'Aries', 'Debilitated': 'Libra', 'Day': 'Sunday' }
      },
      {
        name: 'Moon', slug: 'moon', sanskritName: 'Chandra', symbol: '☽', element: 'Water', significance: 'Mind, Emotions, Mother',
        positiveTraits: ['Nurturing', 'Intuitive', 'Receptive', 'Caring'], negativeTraits: ['Moody', 'Over-sensitive', 'Clingy'],
        remedies: ['Wear a pearl gemstone', 'Respect your mother'], description: 'Chandra governs the mind, emotions, and inner world. It determines mental peace and well-being.',
        status: 'Published', quickFacts: { 'Rules': 'Cancer', 'Exalted': 'Taurus', 'Debilitated': 'Scorpio', 'Day': 'Monday' }
      },
      {
        name: 'Mars', slug: 'mars', sanskritName: 'Mangal', symbol: '♂', element: 'Fire', significance: 'Energy, Courage, Brothers',
        positiveTraits: ['Courageous', 'Determined', 'Energetic', 'Protective'], negativeTraits: ['Aggressive', 'Impulsive', 'Combative'],
        remedies: ['Recite Hanuman Chalisa', 'Donate red lentils on Tuesdays'], description: 'Mangal is the commander-in-chief. It gives us the physical strength and courage to fight for our principles.',
        status: 'Published', quickFacts: { 'Rules': 'Aries, Scorpio', 'Exalted': 'Capricorn', 'Debilitated': 'Cancer', 'Day': 'Tuesday' }
      },
      {
        name: 'Mercury', slug: 'mercury', sanskritName: 'Budha', symbol: '☿', element: 'Earth', significance: 'Intellect, Speech, Commerce',
        positiveTraits: ['Witty', 'Analytical', 'Adaptable', 'Communicative'], negativeTraits: ['Nervous', 'Indecisive', 'Deceptive'],
        remedies: ['Feed green moong dal to birds', 'Wear an emerald ring'], description: 'Budha represents the intellect and the ability to differentiate. It governs speech, writing, education, and commerce.',
        status: 'Published', quickFacts: { 'Rules': 'Gemini, Virgo', 'Exalted': 'Virgo', 'Debilitated': 'Pisces', 'Day': 'Wednesday' }
      },
      {
        name: 'Jupiter', slug: 'jupiter', sanskritName: 'Guru', symbol: '♃', element: 'Ether', significance: 'Wisdom, Fortune, Guru',
        positiveTraits: ['Wise', 'Generous', 'Optimistic', 'Righteous'], negativeTraits: ['Over-indulgent', 'Preachy', 'Wasteful'],
        remedies: ['Respect your teachers and elders', 'Wear a yellow sapphire'], description: 'Guru is the Great Benefic and teacher of the Gods. It represents knowledge, children, and spiritual expansion.',
        status: 'Published', quickFacts: { 'Rules': 'Sagittarius, Pisces', 'Exalted': 'Cancer', 'Debilitated': 'Capricorn', 'Day': 'Thursday' }
      },
      {
        name: 'Venus', slug: 'venus', sanskritName: 'Shukra', symbol: '♀', element: 'Water', significance: 'Love, Beauty, Luxury',
        positiveTraits: ['Charming', 'Artistic', 'Harmonious', 'Romantic'], negativeTraits: ['Vain', 'Lazy', 'Over-indulgent'],
        remedies: ['Donate white clothes on Fridays', 'Respect women'], description: 'Shukra is the teacher of the demons (Asuras). It governs love, marriage, art, luxury, and sensual pleasures.',
        status: 'Published', quickFacts: { 'Rules': 'Taurus, Libra', 'Exalted': 'Pisces', 'Debilitated': 'Virgo', 'Day': 'Friday' }
      },
      {
        name: 'Saturn', slug: 'saturn', sanskritName: 'Shani', symbol: '♄', element: 'Air', significance: 'Karma, Discipline, Delays, Truth',
        positiveTraits: ['Disciplined', 'Patient', 'Hardworking', 'Just'], negativeTraits: ['Pessimistic', 'Harsh', 'Delaying'],
        remedies: ['Help the poor and disabled', 'Light a mustard oil lamp on Saturdays'], description: 'Shani is the strict taskmaster. It gives results of our karmas and teaches through hardship and delay.',
        status: 'Published', quickFacts: { 'Rules': 'Capricorn, Aquarius', 'Exalted': 'Libra', 'Debilitated': 'Aries', 'Day': 'Saturday' }
      },
      {
        name: 'Rahu', slug: 'rahu', sanskritName: 'Rahu', symbol: '☊', element: 'Air', significance: 'Obsession, Materialism, Foreign, Illusion',
        positiveTraits: ['Innovative', 'Ambitious', 'Unorthodox methods'], negativeTraits: ['Deceptive', 'Obsessive', 'Fearful'],
        remedies: ['Keep a peacock feather', 'Respect street sweepers'], description: 'Rahu is the North Node of the Moon. It represents worldly desires, illusions (Maya), and breaking taboos.',
        status: 'Published', quickFacts: { 'Rules': 'Aquarius (co-ruler)', 'Exalted': 'Taurus (debated)', 'Debilitated': 'Scorpio', 'Day': 'Saturday (Night)' }
      },
      {
        name: 'Ketu', slug: 'ketu', sanskritName: 'Ketu', symbol: '☋', element: 'Fire', significance: 'Moksha, Detachment, Spirituality, Past Life',
        positiveTraits: ['Spiritual depth', 'Intuitive', 'Mystical'], negativeTraits: ['Apathy', 'Isolation', 'Confusion'],
        remedies: ['Feed stray dogs', 'Meditate regularly'], description: 'Ketu is the South Node of the Moon. It strips away material illusions to guide the soul towards spiritual liberation.',
        status: 'Published', quickFacts: { 'Rules': 'Scorpio (co-ruler)', 'Exalted': 'Scorpio (debated)', 'Debilitated': 'Taurus', 'Day': 'Tuesday' }
      }
    ];

    // --- Sequential Lessons (Rich HTML) ---
    const lessons = [
      {
        title: 'Introduction to Vedic Astrology',
        slug: 'introduction-to-vedic-astrology',
        partNumber: 1,
        order: 1,
        seriesTitle: 'Learn Astrology',
        shortDescription: 'An introduction to Jyotish Shastra — the ancient Indian science of light.',
        status: 'Published',
        content: `
<p>Welcome to the world of <strong>'No Cost Tutorial'</strong> to learn astrology! It means you do not have to pay for learning astrology through this tutorial. <em>'How to learn astrology'</em> — is a question in minds of those who are even slightly interested in learning the subject.</p>

<p>Here you can learn Astrology in both languages Hindi and English in detail, without worrying about cost. This tutorial is the single window where you can learn astrology or know about the globe of astrology without involving in yourself in jargons.</p>

<h2>What is Vedic Astrology (Jyotish)?</h2>

<p>Vedic Astrology, also known as <strong>Jyotish Shastra</strong> (ज्योतिष शास्त्र), is the traditional Hindu system of astronomy and astrology. The word "Jyotish" literally translates to <em>"Science of Light"</em> or <em>"Lord of Light"</em>.</p>

<p>Unlike Western Astrology which uses the Tropical Zodiac (based on seasons), Vedic Astrology uses the <strong>Sidereal Zodiac</strong> — which is astronomically aligned with the actual positions of the constellations in the sky.</p>

<h2>The Three Branches of Jyotish</h2>

<ol>
<li><strong>Siddhanta (Astronomy)</strong> — Mathematical calculations of planetary positions</li>
<li><strong>Samhita (Mundane Astrology)</strong> — Predictions about countries, weather, earthquakes</li>
<li><strong>Hora (Predictive Astrology)</strong> — Individual birth chart analysis and predictions</li>
</ol>

<h2>Key Differences: Vedic vs Western Astrology</h2>

<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse: collapse;">
<thead>
<tr style="background-color:#f5e6c8;"><th>Feature</th><th>Vedic (Sidereal)</th><th>Western (Tropical)</th></tr>
</thead>
<tbody>
<tr><td>Zodiac</td><td>Fixed to stars</td><td>Fixed to seasons</td></tr>
<tr><td>Ayanamsha</td><td>~24° difference</td><td>No correction</td></tr>
<tr><td>Primary Luminary</td><td>Moon Sign</td><td>Sun Sign</td></tr>
<tr><td>Dasha System</td><td>Yes (Planetary Periods)</td><td>No</td></tr>
<tr><td>Nakshatras</td><td>27 Lunar Mansions</td><td>Not used</td></tr>
</tbody>
</table>

<p>In this series, we will focus on <strong>Hora</strong> — the branch of predictive astrology that helps us understand individual birth charts.</p>

<blockquote><em>"The planets are like the lamps of the Lord. They illuminate the path of our karma."</em></blockquote>
        `
      },
      {
        title: 'The Nine Planets (Navagraha)',
        slug: 'the-nine-planets',
        partNumber: 2,
        order: 2,
        seriesTitle: 'Learn Astrology',
        shortDescription: 'Learn about the 9 Grahas — their nature, signification, and role in predictive astrology.',
        status: 'Published',
        content: `
<p>This is second part of our weekly series on learning Indian astrology. In the <a href="/learn/guides/introduction-to-vedic-astrology">previous article of this series</a>, we learnt the basics of Vedic Astrology. Now, we are going to know about the <strong>nine planets (Navagraha)</strong> and their characteristics.</p>

<h2>Names of Nine Planets</h2>

<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse: collapse;">
<thead>
<tr style="background-color:#f5e6c8;"><th>Planet</th><th>Sanskrit Name</th><th>Nature</th></tr>
</thead>
<tbody>
<tr><td><span style="color: #e74c3c;">Sun</span></td><td>सूर्य (Surya)</td><td>Malefic</td></tr>
<tr><td>Moon</td><td>चंद्र, सोम (Chandra, Som)</td><td>Benefic</td></tr>
<tr><td><span style="color: #e74c3c;">Mars</span></td><td>मंगल, कुज (Mangal, Kuja)</td><td>Malefic</td></tr>
<tr><td>Mercury</td><td>बुध (Budha)</td><td>Neutral</td></tr>
<tr><td>Jupiter</td><td>गुरू, बृहस्पति (Guru, Brihaspati)</td><td>Benefic</td></tr>
<tr><td>Venus</td><td>शुक्र (Shukra)</td><td>Benefic</td></tr>
<tr><td><span style="color: #e74c3c;">Saturn</span></td><td>शनि (Shani)</td><td>Malefic</td></tr>
<tr><td><span style="color: #e74c3c;">North Node</span></td><td>राहु (Rahu)</td><td>Malefic</td></tr>
<tr><td><span style="color: #e74c3c;">South Node</span></td><td>केतु (Ketu)</td><td>Malefic</td></tr>
</tbody>
</table>

<p><strong>Natural Benefic Planets:</strong> <span style="color: #27ae60;">Moon, Mercury, Venus and Jupiter</span> are considered benefic by nature.</p>
<p><strong>Natural Malefic Planets:</strong> <span style="color: #e74c3c;">Sun, Mars, Saturn, Rahu and Ketu</span> are considered malefic by nature.</p>

<h2>Zodiac Signs</h2>
<p>Indian astrology is earth-centric. Zodiac is a circular belt and all planets seem to be moving on this belt. If this zodiac is divided into twelve equal parts, each part is known as a <strong>zodiac sign (Rashi)</strong>.</p>

<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse: collapse;">
<thead>
<tr style="background-color:#f5e6c8;"><th>Zodiac Sign</th><th>Sanskrit Name</th><th>Governing Planet</th></tr>
</thead>
<tbody>
<tr><td>Aries</td><td>Mesha</td><td><span style="color: #e74c3c;">Mars</span></td></tr>
<tr><td>Taurus</td><td>Vrishabha</td><td><span style="color: #27ae60;">Venus</span></td></tr>
<tr><td>Gemini</td><td>Mithun</td><td>Mercury</td></tr>
<tr><td>Cancer</td><td>Karka</td><td>Moon</td></tr>
<tr><td>Leo</td><td>Simha</td><td><span style="color: #e74c3c;">Sun</span></td></tr>
<tr><td>Virgo</td><td>Kanya</td><td>Mercury</td></tr>
<tr><td>Libra</td><td>Tula</td><td><span style="color: #27ae60;">Venus</span></td></tr>
<tr><td>Scorpio</td><td>Vrishchik</td><td><span style="color: #e74c3c;">Mars</span></td></tr>
<tr><td>Sagittarius</td><td>Dhanu</td><td><span style="color: #27ae60;">Jupiter</span></td></tr>
<tr><td>Capricorn</td><td>Makar</td><td><span style="color: #e74c3c;">Saturn</span></td></tr>
<tr><td>Aquarius</td><td>Kumbh</td><td><span style="color: #e74c3c;">Saturn</span></td></tr>
<tr><td>Pisces</td><td>Meen</td><td><span style="color: #27ae60;">Jupiter</span></td></tr>
</tbody>
</table>

<h2>Exaltation and Debilitation</h2>
<p>Each planet performs best in one sign (<strong>Exalted</strong>) and worst in another (<strong>Debilitated</strong>). The exalted and debilitated signs of a planet are always seventh from each other.</p>

<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse: collapse;">
<thead>
<tr style="background-color:#f5e6c8;"><th>S.No.</th><th>Planet</th><th>Exalted Sign</th><th>Debilitated Sign</th><th>Own Sign</th></tr>
</thead>
<tbody>
<tr><td>1</td><td>Sun</td><td><span style="color: #27ae60;">Aries</span></td><td><span style="color: #e74c3c;">Libra</span></td><td>Leo</td></tr>
<tr><td>2</td><td>Moon</td><td><span style="color: #27ae60;">Taurus</span></td><td><span style="color: #e74c3c;">Scorpio</span></td><td>Cancer</td></tr>
<tr><td>3</td><td>Mars</td><td><span style="color: #27ae60;">Capricorn</span></td><td><span style="color: #e74c3c;">Cancer</span></td><td>Aries, Scorpio</td></tr>
<tr><td>4</td><td>Mercury</td><td><span style="color: #27ae60;">Virgo</span></td><td><span style="color: #e74c3c;">Pisces</span></td><td>Gemini, Virgo</td></tr>
<tr><td>5</td><td>Jupiter</td><td><span style="color: #27ae60;">Cancer</span></td><td><span style="color: #e74c3c;">Capricorn</span></td><td>Sagittarius, Pisces</td></tr>
<tr><td>6</td><td>Venus</td><td><span style="color: #27ae60;">Pisces</span></td><td><span style="color: #e74c3c;">Virgo</span></td><td>Taurus, Libra</td></tr>
<tr><td>7</td><td>Saturn</td><td><span style="color: #27ae60;">Libra</span></td><td><span style="color: #e74c3c;">Aries</span></td><td>Capricorn, Aquarius</td></tr>
</tbody>
</table>
        `
      },
      {
        title: 'The 12 Houses (Bhavas)',
        slug: 'the-twelve-houses',
        partNumber: 3,
        order: 3,
        seriesTitle: 'Learn Astrology',
        shortDescription: 'This week we learn how to interpret the diagram of a birth chart — houses and ascendant.',
        status: 'Published',
        content: `
<p>This is third part of our series on learning Indian astrology. In the <a href="/learn/guides/the-nine-planets">previous article</a>, we learnt about zodiac signs, planets and their ownership.</p>

<ul>
<li><a href="/learn/guides/introduction-to-vedic-astrology">Learn Indian Astrology - 1</a></li>
<li><a href="/learn/guides/the-nine-planets">Learn Indian Astrology - 2</a></li>
</ul>

<p>This week we will learn how to interpret the diagram of a <strong>birth chart</strong>. We will also get to know concepts like <em>ascendant</em> and <em>house</em> etc.</p>

<h2>What is a Birth Chart?</h2>

<p>A birth-chart (also called <strong>Kundli</strong> or Horoscope in India) can be called a map of planetary positions at the time of birth. Mainly, horoscope is drawn in three major ways — north Indian style, south Indian style and Bangla (East Indian) style. To keep it simple, we will restrict our discussion to <strong>north Indian style</strong> only.</p>

<h2>Houses (Sanskrit: भाव)</h2>

<p>To understand what is a house, we will have to look at a birth chart diagram. A birth chart can be decamped in <strong>12 boxes</strong>, out of which eight are triangular and four are rectangular in shape.</p>

<p>The four rectangles are considered to be the four "corners" or <strong>Kendras</strong>. The topmost rectangle is considered to be "ascendant" or the <strong>"first house"</strong>. Position of ascendant is always fixed in the birth chart.</p>

<h2>House-lord (Sanskrit: भावेश)</h2>

<p>"House" and "sign" are two different concepts. The numbers written in a horoscope denote zodiac signs. Therefore, in astrological language we will say that the lord of a house is determined by the sign that occupies it.</p>

<h2>The 12 Houses and Their Significations</h2>

<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse: collapse;">
<thead>
<tr style="background-color:#f5e6c8;"><th>House</th><th>Name</th><th>Key Areas</th></tr>
</thead>
<tbody>
<tr><td><strong>1st</strong></td><td>Ascendant (Lagna)</td><td>Self, body, personality, appearance</td></tr>
<tr><td><strong>2nd</strong></td><td>Dhana Bhava</td><td>Wealth, family, speech, food</td></tr>
<tr><td><strong>3rd</strong></td><td>Sahaj Bhava</td><td>Siblings, courage, short travels</td></tr>
<tr><td><strong>4th</strong></td><td>Sukh Bhava</td><td>Mother, home, vehicles, inner peace</td></tr>
<tr><td><strong>5th</strong></td><td>Putra Bhava</td><td>Children, intelligence, romance, creativity</td></tr>
<tr><td><strong>6th</strong></td><td>Ari Bhava</td><td>Enemies, diseases, debts, obstacles</td></tr>
<tr><td><strong>7th</strong></td><td>Yuvati Bhava</td><td>Marriage, partnerships, business</td></tr>
<tr><td><strong>8th</strong></td><td>Randhra Bhava</td><td>Longevity, transformation, occult</td></tr>
<tr><td><strong>9th</strong></td><td>Dharma Bhava</td><td>Fortune, father, religion, higher learning</td></tr>
<tr><td><strong>10th</strong></td><td>Karma Bhava</td><td>Career, status, public image, karma</td></tr>
<tr><td><strong>11th</strong></td><td>Labh Bhava</td><td>Gains, income, elder siblings, wishes</td></tr>
<tr><td><strong>12th</strong></td><td>Vyaya Bhava</td><td>Losses, expenses, foreign travels, moksha</td></tr>
</tbody>
</table>
        `
      },
      {
        title: 'House Signification & Prediction Basics',
        slug: 'house-signification',
        partNumber: 4,
        order: 4,
        seriesTitle: 'Learn Astrology',
        shortDescription: 'Learn how predictions are made by combining nature and signification of planets, signs and houses.',
        status: 'Published',
        content: `
<p>This is fourth part of our series on learning Indian astrology. To read earlier parts:</p>

<ul>
<li><a href="/learn/guides/introduction-to-vedic-astrology">Learn Indian Astrology - 1</a></li>
<li><a href="/learn/guides/the-nine-planets">Learn Indian Astrology - 2</a></li>
<li><a href="/learn/guides/the-twelve-houses">Learn Indian Astrology - 3</a></li>
</ul>

<p>In astrology, predictions are based on <strong>nature and significations of planets, signs, houses, and their inter-relations</strong>.</p>

<h2>Nature vs Signification</h2>

<p>Just like living beings, planets have <strong>"nature"</strong> in astrology. Other than this, planets also have <strong>"significations"</strong>. It is of utmost importance to understand the difference between "nature" and "signification".</p>

<p><strong>In simple words, "nature" tells about "how" and "signification" answers "what".</strong></p>

<h2>Significations of Houses</h2>

<p><strong>First house:</strong> It signifies birth, head, nature, body, organs, age, looks, height and caste etc.</p>
<p><strong>Second house:</strong> It shows money, monetary gain, eyes, face, voice, economical condition, family, food, tongue, teeth, death and nose etc.</p>
<p><strong>Third house:</strong> It depicts younger siblings, courage, fear, ears, strength and mental balance etc.</p>
<p><strong>Fourth house:</strong> It indicates pleasure, education, vehicles, heart, property, house, mother, relatives, domestic animals and buildings etc.</p>
<p><strong>Fifth house:</strong> It suggests progeny, intelligence, laudable actions or work, charity, entertainment and gambling etc.</p>
<p><strong>Sixth house:</strong> It points at diseases, bodily deformity, troubles caused by foes, tension, wound, litigation, brothers of mother and depression etc.</p>
<p><strong>Seventh house:</strong> It stands for marriage, wife, sex, travel, death, business and partners etc.</p>
<p><strong>Eighth house:</strong> It represents longevity, battle, enemies, forts, wealth of the dead, misery and blame etc.</p>
<p><strong>Ninth house:</strong> It symbolizes fortune, father, religion, higher education, long journeys, spirituality and pilgrimages etc.</p>
<p><strong>Tenth house:</strong> It means profession, commerce, rank, authority, father, living abroad and honor from government etc.</p>
<p><strong>Eleventh house:</strong> It conveys gains, income, prosperity, elder brothers, friends, fulfillment of wishes and left ear etc.</p>
<p><strong>Twelfth house:</strong> It implies expenditure, loss, punishment, imprisonment, hospitalization, foreign travel and moksha etc.</p>
        `
      },
      {
        title: 'Aspects and Planetary Friendships',
        slug: 'aspects-and-friendships',
        partNumber: 5,
        order: 5,
        seriesTitle: 'Learn Astrology',
        shortDescription: 'Understanding planetary aspects (Drishti) and the friendship-enmity relationship between Grahas.',
        status: 'Published',
        content: `
<p>This is fifth part of our series on learning Indian astrology. In earlier parts, we covered planets, zodiac signs, houses and their significations.</p>

<ul>
<li><a href="/learn/guides/introduction-to-vedic-astrology">Part 1 - Introduction</a></li>
<li><a href="/learn/guides/the-nine-planets">Part 2 - Planets</a></li>
<li><a href="/learn/guides/the-twelve-houses">Part 3 - Houses</a></li>
<li><a href="/learn/guides/house-signification">Part 4 - Signification</a></li>
</ul>

<h2>What is an Aspect (Drishti)?</h2>

<p>In Vedic astrology, each planet <strong>"looks at" or "aspects"</strong> other houses from where it is placed. This is called <strong>Drishti (दृष्टि)</strong>. An aspect is like the influence a planet casts on other houses and planets.</p>

<h3>Standard Aspects</h3>
<p>All planets aspect the <strong>7th house</strong> from their position. This means, every planet influences the house exactly opposite to it.</p>

<h3>Special Aspects</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse: collapse;">
<thead>
<tr style="background-color:#f5e6c8;"><th>Planet</th><th>Special Aspects</th><th>Meaning</th></tr>
</thead>
<tbody>
<tr><td><strong>Mars</strong></td><td>4th and 8th house</td><td>Mars aspects houses 4, 7, and 8 from itself</td></tr>
<tr><td><strong>Jupiter</strong></td><td>5th and 9th house</td><td>Jupiter aspects houses 5, 7, and 9 from itself</td></tr>
<tr><td><strong>Saturn</strong></td><td>3rd and 10th house</td><td>Saturn aspects houses 3, 7, and 10 from itself</td></tr>
<tr><td><strong>Rahu/Ketu</strong></td><td>5th and 9th house</td><td>Same as Jupiter (debated)</td></tr>
</tbody>
</table>

<h2>Planetary Friendships</h2>

<p>Planets have natural friendships and enmities with each other. This relationship affects how planets behave in different signs.</p>

<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse: collapse;">
<thead>
<tr style="background-color:#f5e6c8;"><th>Planet</th><th>Friends</th><th>Neutral</th><th>Enemies</th></tr>
</thead>
<tbody>
<tr><td>Sun</td><td>Moon, Mars, Jupiter</td><td>Mercury</td><td>Venus, Saturn</td></tr>
<tr><td>Moon</td><td>Sun, Mercury</td><td>Mars, Jupiter, Venus, Saturn</td><td>None</td></tr>
<tr><td>Mars</td><td>Sun, Moon, Jupiter</td><td>Venus, Saturn</td><td>Mercury</td></tr>
<tr><td>Mercury</td><td>Sun, Venus</td><td>Mars, Jupiter, Saturn</td><td>Moon</td></tr>
<tr><td>Jupiter</td><td>Sun, Moon, Mars</td><td>Saturn</td><td>Mercury, Venus</td></tr>
<tr><td>Venus</td><td>Mercury, Saturn</td><td>Mars, Jupiter</td><td>Sun, Moon</td></tr>
<tr><td>Saturn</td><td>Mercury, Venus</td><td>Jupiter</td><td>Sun, Moon, Mars</td></tr>
</tbody>
</table>
        `
      },
      {
        title: 'Reading Your Birth Chart (Kundli)',
        slug: 'reading-your-kundli',
        partNumber: 6,
        order: 6,
        seriesTitle: 'Learn Astrology',
        shortDescription: 'A practical step-by-step guide to reading and interpreting your own North Indian birth chart.',
        status: 'Published',
        content: `
<p>This is the sixth and final part of our introductory series. Having covered all the fundamentals — planets, signs, houses, significations, and aspects — you are now ready to <strong>read your own birth chart</strong>.</p>

<ul>
<li><a href="/learn/guides/introduction-to-vedic-astrology">Part 1 - Introduction</a></li>
<li><a href="/learn/guides/the-nine-planets">Part 2 - Planets</a></li>
<li><a href="/learn/guides/the-twelve-houses">Part 3 - Houses</a></li>
<li><a href="/learn/guides/house-signification">Part 4 - Signification</a></li>
<li><a href="/learn/guides/aspects-and-friendships">Part 5 - Aspects</a></li>
</ul>

<h2>Step 1: Generate Your Kundli</h2>
<p>Use the <a href="/kundli"><strong>free Kundli generator on VaidikTalk</strong></a> to create your birth chart by entering your exact date, time, and place of birth.</p>

<h2>Step 2: Find Your Ascendant (Lagna)</h2>
<p>In the North Indian chart, look at the <strong>top-center diamond</strong>. The number written there is your Ascendant sign. This is the foundation of your entire horoscope.</p>

<h2>Step 3: Locate the Moon</h2>
<p>Find the Moon in your chart. The sign where the Moon is placed determines your <strong>Moon Sign (Rashi)</strong> and your <strong>Nakshatra</strong>. This is the most important planet in Vedic astrology.</p>

<h2>Step 4: Check Planet Strengths</h2>

<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse: collapse;">
<thead>
<tr style="background-color:#f5e6c8;"><th>Condition</th><th>Meaning</th><th>Effect</th></tr>
</thead>
<tbody>
<tr><td><span style="color: #27ae60;"><strong>Exalted</strong></span></td><td>Planet in its strongest sign</td><td>Gives excellent results of its significations</td></tr>
<tr><td><span style="color: #27ae60;"><strong>Own Sign</strong></span></td><td>Planet in the sign it rules</td><td>Gives comfortable, natural results</td></tr>
<tr><td><strong>Friendly Sign</strong></td><td>Planet in a friend's sign</td><td>Gives generally good results</td></tr>
<tr><td><span style="color: #e74c3c;"><strong>Debilitated</strong></span></td><td>Planet in its weakest sign</td><td>Struggles to deliver its significations</td></tr>
<tr><td><span style="color: #e74c3c;"><strong>Enemy Sign</strong></span></td><td>Planet in an enemy's sign</td><td>Faces friction and challenges</td></tr>
</tbody>
</table>

<h2>Step 5: Analyze House Lords</h2>
<p>For each important area of life (career, marriage, children), find the relevant house, identify its lord, and see where that lord is placed and what aspects it receives.</p>

<h2>What's Next?</h2>
<p>This concludes our introductory series. You now have the foundational knowledge to begin your journey in Vedic astrology. For deeper learning, explore our <a href="/learn/planets"><strong>Planet Library</strong></a> for detailed profiles of each Graha.</p>

<blockquote><em>"ज्योतिषां सूर्यो गतिःs" — The Sun is the soul of astrology. May the light of Jyotish illuminate your path.</em></blockquote>
        `
      }
    ];

    for (const p of planets) {
      await this.planetModel.findOneAndUpdate({ name: p.name }, { $set: p }, { upsert: true });
    }

    for (const lesson of lessons) {
      await this.guideModel.findOneAndUpdate({ slug: lesson.slug }, { $set: lesson }, { upsert: true });
    }

    return { message: 'Sequential lessons and planet profiles seeded successfully' };
  }
}
