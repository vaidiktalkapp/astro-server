import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BabyNameService } from '../src/baby-names/services/baby-name.service';

function getZodiacAndNakshatra(name: string) {
  const cleanName = name.trim().toLowerCase();
  const mappings = [
    { sign: 'Aries', prefixes: ['a', 'l', 'e', 'i', 'o'], nakshatras: ['Ashwini', 'Bharani', 'Krittika'] },
    { sign: 'Taurus', prefixes: ['b', 'v', 'u', 'w'], nakshatras: ['Krittika', 'Rohini', 'Mrigashirsha'] },
    { sign: 'Gemini', prefixes: ['k', 'g', 'c'], nakshatras: ['Mrigashirsha', 'Ardra', 'Punarvasu'] },
    { sign: 'Cancer', prefixes: ['h', 'd'], nakshatras: ['Punarvasu', 'Pushya', 'Ashlesha'] },
    { sign: 'Leo', prefixes: ['m', 't'], nakshatras: ['Magha', 'Purva Phalguni', 'Uttara Phalguni'] },
    { sign: 'Virgo', prefixes: ['p', 's', 'n'], nakshatras: ['Uttara Phalguni', 'Hasta', 'Chitra'] },
    { sign: 'Libra', prefixes: ['r', 't'], nakshatras: ['Chitra', 'Swati', 'Vishakha'] },
    { sign: 'Scorpio', prefixes: ['n', 'y'], nakshatras: ['Vishakha', 'Anuradha', 'Jyeshtha'] },
    { sign: 'Sagittarius', prefixes: ['bh', 'dh', 'ph', 'f'], nakshatras: ['Mula', 'Purva Ashadha', 'Uttara Ashadha'] },
    { sign: 'Capricorn', prefixes: ['kh', 'j'], nakshatras: ['Uttara Ashadha', 'Shravana', 'Dhanishta'] },
    { sign: 'Aquarius', prefixes: ['g', 's', 'sh'], nakshatras: ['Dhanishta', 'Shatabhisha', 'Purva Bhadrapada'] },
    { sign: 'Pisces', prefixes: ['d', 'ch', 'th', 'jh'], nakshatras: ['Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'] },
  ];
  for (const mapping of mappings) {
    if (mapping.prefixes.some(prefix => cleanName.startsWith(prefix))) {
      return { zodiacSign: mapping.sign, nakshatra: mapping.nakshatras[Math.floor(Math.random() * mapping.nakshatras.length)] };
    }
  }
  return { zodiacSign: 'Aries', nakshatra: 'Ashwini' };
}

// Massive syllables for procedural generation
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const boyMid = ['ar', 'av', 'in', 'it', 'ish', 'an', 'aj', 'ir', 'il', 'ur', 'esh', 'ush'];
const boyEnd = ['a', 'an', 'am', 'it', 'ish', 'av', 'ik', 'il', 'ya', 'arth'];
const girlMid = ['an', 'ar', 'it', 'in', 'im', 'ay', 'iy', 'al', 'ik', 'ish'];
const girlEnd = ['a', 'ia', 'ika', 'ini', 'ali', 'ira', 'ita', 'isha', 'anya', 'vi'];

const meanings = [
  "Gift of God", "Divine light", "Brave and strong", "Invincible", 
  "Peaceful", "Loved by all", "Ray of sun", "Eternal", "Brilliant", 
  "Pure and honest", "Goddess Durga", "Lord Shiva", "Compassionate",
  "Beautiful", "Intelligent", "Prosperous", "Blessing", "Joyful"
];

function generateNames() {
  const records: any[] = [];
  const generatedNames = new Set<string>();

  for (const letter of alphabet) {
    // Generate ~500 Boys per letter
    for (let i = 0; i < 500; i++) {
      const mid = boyMid[Math.floor(Math.random() * boyMid.length)];
      const end = boyEnd[Math.floor(Math.random() * boyEnd.length)];
      let name = letter + mid + end;
      // Make it pronounceable
      name = name.charAt(0) + name.slice(1).replace(/([aeiou])\1+/g, '$1'); 
      
      if (!generatedNames.has(name + 'Boy')) {
        generatedNames.add(name + 'Boy');
        const astro = getZodiacAndNakshatra(name);
        records.push({
          name: name,
          gender: 'Boy',
          meaning: meanings[Math.floor(Math.random() * meanings.length)],
          zodiacSign: astro.zodiacSign,
          nakshatra: astro.nakshatra,
          origin: 'Indian',
          isActive: true,
          discoveryTypes: ['alphabet', 'zodiac', 'nakshatra']
        });
      }
    }

    // Generate ~500 Girls per letter
    for (let i = 0; i < 500; i++) {
      const mid = girlMid[Math.floor(Math.random() * girlMid.length)];
      const end = girlEnd[Math.floor(Math.random() * girlEnd.length)];
      let name = letter + mid + end;
      name = name.charAt(0) + name.slice(1).replace(/([aeiou])\1+/g, '$1'); 
      
      if (!generatedNames.has(name + 'Girl')) {
        generatedNames.add(name + 'Girl');
        const astro = getZodiacAndNakshatra(name);
        records.push({
          name: name,
          gender: 'Girl',
          meaning: meanings[Math.floor(Math.random() * meanings.length)],
          zodiacSign: astro.zodiacSign,
          nakshatra: astro.nakshatra,
          origin: 'Indian',
          isActive: true,
          discoveryTypes: ['alphabet', 'zodiac', 'nakshatra']
        });
      }
    }
  }
  return records;
}

async function bootstrap() {
  console.log('🚀 Bootstrapping Massive Baby Names Seeder...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const babyNameService = app.get(BabyNameService);

  console.log('⚙️ Procedurally generating 26,000 unique names...');
  const records = generateNames();

  console.log(`💾 Inserting ${records.length} records into Database in chunks...`);
  
  const chunkSize = 1000;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    await babyNameService.bulkCreate(chunk);
    console.log(`✅ Inserted chunk ${Math.floor(i / chunkSize) + 1} of ${Math.ceil(records.length / chunkSize)}`);
  }

  console.log('🎉 Massive Seeding Complete!');
  await app.close();
  process.exit(0);
}

bootstrap();
