const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';

const categories = [
    { name: 'Compatibility', slug: 'compatibility', description: 'Love and relationship compatibility', isActive: true },
    { name: 'Vedic', slug: 'vedic', description: 'Vedic astrology and remedies', isActive: true },
    { name: 'Vastu', slug: 'vastu', description: 'Vastu Shastra tips and guides', isActive: true },
    { name: 'Kundli', slug: 'kundli', description: 'Janam kundli and dosha analysis', isActive: true },
    { name: 'Astrologers', slug: 'astrologers', description: 'Online astrology consultation', isActive: true }
];

const blogs = [
    { title: 'Find Your Soulmate with Love Compatibility Astrology', catSlug: 'compatibility' },
    { title: 'Why Lal Kitab Is Popular in Vedic Astrology', catSlug: 'vedic' },
    { title: 'Personalized Lal Kitab for Wealth, Health & Relationship Success', catSlug: 'vedic' },
    { title: 'Lucky Colours for Each Day of the Week According to Astrology', catSlug: 'vedic' },
    { title: 'How to Prepare a Kundli Online for Accurate Matchmaking Results', catSlug: 'kundli' },
    { title: 'Why Vaidik Smart Kundali is the Future of Online Kundli Astrology', catSlug: 'kundli' },
    { title: 'Pitru Dosh Report: Symptoms, Effects & How to Remove Pitra Dosh', catSlug: 'kundli' },
    { title: 'Best Rahu Ketu Dosh Report Online for Accurate Astrology Analysis', catSlug: 'kundli' },
    { title: 'Chat with Astrologer Online - Talk to Experts, Free First Chat', catSlug: 'astrologers' },
    { title: 'Chat with AI Astrologer — Instant, Free AI Astrology Online', catSlug: 'astrologers' }
];

function slugify(text) {
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    const db = mongoose.connection;
    const catCol = db.collection('blogcategories');
    const blogCol = db.collection('blogs');

    const catMap = {};

    // 1. Add categories
    for (const cat of categories) {
        let existingCat = await catCol.findOne({ slug: cat.slug });
        if (!existingCat) {
            const res = await catCol.insertOne({ ...cat, createdAt: new Date(), updatedAt: new Date() });
            catMap[cat.slug] = res.insertedId;
            console.log(`Created category: ${cat.name}`);
        } else {
            catMap[cat.slug] = existingCat._id;
            console.log(`Category exists: ${cat.name}`);
        }
    }

    // 2. Fix the Vastu blog we added earlier to use the new Vastu category
    if (catMap['vastu']) {
        await blogCol.updateOne(
            { slug: '5-signs-your-home-needs-a-vastu-expert' },
            { $set: { category: catMap['vastu'] } }
        );
        console.log('Updated Vastu blog to new Vastu category');
    }

    // 3. Add blogs
    for (const blog of blogs) {
        const slug = slugify(blog.title);
        const existingBlog = await blogCol.findOne({ slug });
        
        if (!existingBlog) {
            await blogCol.insertOne({
                title: blog.title,
                slug: slug,
                content: `<p>This is a placeholder content for ${blog.title}. You can edit this content from the admin panel.</p>`,
                bannerImage: 'https://images.unsplash.com/photo-1598090216740-eb040d8c3f82?q=72&w=480&h=360&fit=crop',
                category: catMap[blog.catSlug],
                status: 'published',
                isFeatured: false,
                views: Math.floor(Math.random() * 100),
                seoTitle: blog.title,
                seoDescription: blog.title,
                authorName: 'VaidikTalk Editorial',
                publishedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log(`Created blog: ${blog.title}`);
        } else {
            // just update category if it already existed
            await blogCol.updateOne(
                { _id: existingBlog._id },
                { $set: { category: catMap[blog.catSlug] } }
            );
            console.log(`Blog exists: ${blog.title} (Updated category)`);
        }
    }

    console.log('Done!');
    process.exit(0);
  }).catch(err => {
      console.error(err);
      process.exit(1);
  });
