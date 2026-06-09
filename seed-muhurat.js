
require('dotenv').config();
const mongoose = require('mongoose');

async function seed() {
  const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://vadiktalk:7fnBvxiPrutuSu7G@cluster0.zjkqtzw.mongodb.net/vaidiktalk';
  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    
    const categories = [
      { 
        name: 'Marriage', 
        slug: 'marriage', 
        icon: 'Heart', 
        subtitle: 'Vivah Muhurat',
        description: 'Auspicious dates for weddings and marriage ceremonies.', 
        isActive: true 
      },
      { 
        name: 'Business', 
        slug: 'business', 
        icon: 'Briefcase', 
        subtitle: 'Vyapaar Muhurat',
        description: 'Best times to start a new business, shop or office.', 
        isActive: true 
      },
      { 
        name: 'Housewarming', 
        slug: 'housewarming', 
        icon: 'Home', 
        subtitle: 'Griha Pravesh',
        description: 'Lucky dates for entering and inhabiting a new home.', 
        isActive: true 
      },
      { 
        name: 'Naming Ceremony', 
        slug: 'namkaran', 
        icon: 'Baby', 
        subtitle: 'Namkaran Muhurat',
        description: 'Auspicious time for the naming ceremony of a newborn.', 
        isActive: true 
      },
      { 
        name: 'Vehicle Purchase', 
        slug: 'vehicle-purchase', 
        icon: 'Car', 
        subtitle: 'Vahan Kharid',
        description: 'Best dates for purchasing or starting to use a new vehicle.', 
        isActive: true 
      },
      { 
        name: 'Property Purchase', 
        slug: 'property-purchase', 
        icon: 'Building', 
        subtitle: 'Sampatti Kharid',
        description: 'Auspicious days for buying property or land.', 
        isActive: true 
      },
      { 
        name: 'Engagement', 
        slug: 'engagement', 
        icon: 'Ring', 
        subtitle: 'Sagai Muhurat',
        description: 'Lucky dates for engagement or ring ceremonies.', 
        isActive: true 
      },
      { 
        name: 'Foundation Stone', 
        slug: 'foundation-stone', 
        icon: 'Hammer', 
        subtitle: 'Bhoomi Pujan',
        description: 'Best times for laying the foundation stone of a new building.', 
        isActive: true 
      },
      { 
        name: 'Tonsure', 
        slug: 'tonsure', 
        icon: 'Scissors', 
        subtitle: 'Mundan Muhurat',
        description: 'Auspicious time for the first haircut of a child.', 
        isActive: true 
      },
      { 
        name: 'Education Start', 
        slug: 'vidhyarambh', 
        icon: 'BookOpen', 
        subtitle: 'Vidhyarambh Muhurat',
        description: 'Lucky dates for starting a child\'s education or school.', 
        isActive: true 
      }
    ];

    console.log('Seeding Muhurat categories...');
    
    for (const cat of categories) {
      await db.collection('muhuratcategories').updateOne(
        { slug: cat.slug },
        { $set: cat },
        { upsert: true }
      );
      console.log(`- Seeded/Updated: ${cat.name} (${cat.slug})`);
    }
    
    console.log('Successfully seeded 10 categories.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding categories:', err);
    process.exit(1);
  }
}

seed();
