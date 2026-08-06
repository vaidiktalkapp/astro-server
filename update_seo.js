const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';

const seoUpdates = [
    {
        slug: 'find-your-soulmate-with-love-compatibility-astrology',
        seoTitle: 'Find Your Soulmate with Love Compatibility Astrology',
        seoDescription: 'Love compatibility astrology helps you understand relationship dynamics, identify soulmate connections, and strengthen emotional bonds through personalized Vedic astrology insights.',
        seoKeywords: 'kundli, vastu, lal kitab, dosh, astrology'
    },
    {
        slug: 'why-lal-kitab-is-popular-in-vedic-astrology',
        seoTitle: 'Why Lal Kitab Is Popular in Vedic Astrology',
        seoDescription: 'Learn why Lal Kitab is popular in Vedic astrology, its unique approach, practical remedies, and how it helps address career, relationships, finances, and life challenges.',
        seoKeywords: 'kundli, vastu, lal kitab, dosh, astrology'
    },
    {
        slug: '5-signs-your-home-needs-a-vastu-expert',
        seoTitle: '5 Signs Your Home Needs a Vastu Expert',
        seoDescription: 'Notice recurring problems at home? Learn the 5 signs your home may need a Vastu expert and how Vastu guidance can help create a more balanced and harmonious living space.',
        seoKeywords: 'kundli, vastu, lal kitab, dosh, astrology'
    },
    {
        slug: 'lucky-colours-for-each-day-of-the-week-according-to-astrology',
        seoTitle: 'Lucky Colours for Each Day of the Week According to Astrology',
        seoDescription: 'Unlock personalized colour recommendations based on your birth chart with Vaidik Talk. Call with Astrologers for trusted Vedic guidance and make confident daily decisions',
        seoKeywords: 'kundli, vastu, lal kitab, dosh, astrology'
    },
    {
        slug: 'chat-with-astrologer-online-talk-to-experts-free-first-chat',
        seoTitle: 'Talk to Astrologer experts at Vaidik Talk today. Start with a free consultation and get personalized guidance.',
        seoDescription: 'Online astrologer chat allows you to ask any question you wish of the astrologer. Flexibility is one of the major benefits of online astrology readings. Discuss a variety of situations, such as life, and get one-on-one advice depending on your situation.',
        seoKeywords: 'kundli, vastu, lal kitab, dosh, astrology'
    },
    {
        slug: 'pitru-dosh-report-symptoms-effects-how-to-remove-pitra-dosh',
        seoTitle: 'Pitra Dosh Pooja: Remedies, Effects & Solutions',
        seoDescription: 'Learn about Pitra Dosh Pooja, its symptoms, effects, causes, and effective remedies to remove Pitra Dosh and bring peace, prosperity, and harmony.',
        seoKeywords: 'kundli, vastu, lal kitab, dosh, astrology'
    },
    {
        slug: 'chat-with-ai-astrologer-instant-free-ai-astrology-online',
        seoTitle: 'Chat with AI Astrologer — Instant, Free AI Astrology Online',
        seoDescription: 'Instant, Free AI Astrology Online - An AI astrologer is a way to begin if you are new to astrology or want fast answers to daily questions.',
        seoKeywords: 'kundli, vastu, lal kitab, dosh, astrology'
    },
    {
        slug: 'best-rahu-ketu-dosh-report-online-for-accurate-astrology-analysis',
        seoTitle: 'Precise Rahu Ketu Dosha Reports: Unlocking Success Through Accurate Astrology Analysis',
        seoDescription: 'Unlock success through accurate astrology analysis with our precise Rahu Ketu Dosha reports. Understand the impact of Rahu and Ketu in your Kundli.',
        seoKeywords: 'kundli, vastu, lal kitab, dosh, astrology'
    },
    {
        slug: 'personalized-lal-kitab-for-wealth-health-relationship-success',
        seoTitle: 'Personalised Lal Kitab for Wealth, Health & Success',
        seoDescription: 'Get a personalised Lal Kitab consultation for wealth, health, relationships and success. Discover effective Lal Kitab remedies based on your needs.',
        seoKeywords: 'kundli, vastu, lal kitab, dosh, astrology'
    },
    {
        slug: 'how-to-prepare-a-kundli-online-for-accurate-matchmaking-results',
        seoTitle: 'Online Kundali Matching for Accurate Matchmaking',
        seoDescription: 'Get accurate marriage predictions with online kundali matching. Learn how to prepare a kundli online for reliable horoscope compatibility results.',
        seoKeywords: 'kundli, vastu, lal kitab, dosh, astrology'
    },
    {
        slug: 'why-vaidik-smart-kundali-is-the-future-of-online-kundli-astrology',
        seoTitle: 'Vaidik Smart Kundali: Future of Online Astrology',
        seoDescription: 'Discover how Vaidik Smart Kundali transforms online astrology with accurate insights, smart predictions, and personalized kundli guidance for everyone.',
        seoKeywords: 'kundli, vastu, lal kitab, dosh, astrology'
    }
];

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB for SEO updates');
    const db = mongoose.connection;
    const blogCol = db.collection('blogs');

    for (const update of seoUpdates) {
        const result = await blogCol.updateOne(
            { slug: update.slug },
            { $set: { 
                seoTitle: update.seoTitle, 
                seoDescription: update.seoDescription, 
                seoKeywords: update.seoKeywords 
            }}
        );
        console.log(`Updated ${update.slug}: ${result.modifiedCount} modified`);
    }

    console.log('Done updating SEO metadata!');
    process.exit(0);
  }).catch(err => {
      console.error(err);
      process.exit(1);
  });
