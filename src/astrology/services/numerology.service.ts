import { Injectable } from '@nestjs/common';
import { 
  CHALDEAN_MAP, 
  NUM_ARCHETYPES, 
  NUM_COMPAT, 
  NUM_INSIGHTS,
  NAME_RASHI_MAP,
  ZODIAC_SIGNS 
} from '../constants/compatibility.constants';
import { CompatibilitySettingsService } from '../../compatibility-settings/compatibility-settings.service';

export const NUM_DATA: Record<number, any> = {
  1: {
      radical: 'Radical Number 1',
      description: 'You are an ambitious leader with strong willpower and original ideas. You possess natural authority and independence.',
      sign: 'Leo, Aries, Sagittarius',
      alphabets: 'A, I, J, Q, Y',           
      gemstone: 'Ruby (Manik)',
      days: 'Sunday, Monday, Thursday',
      numbers: '1, 2, 3, 5, 9',
      direction: 'East',
      colour: 'Orange, Gold, Yellow',
      planet: 'Sun',
      deity: 'Lord Rama / Surya',
      fast: 'Sunday',
      dates: '1st, 10th, 19th, 28th, 2nd, 11th, 20th, 29th, 3rd, 12th, 21st, 30th'
  },
  2: {
      radical: 'Radical Number 2',
      description: 'You are highly imaginative, sensitive, and harmonious. You value peace and artistic expression deeply.',
      sign: 'Cancer, Leo',
      alphabets: 'B, K, R',                  
      gemstone: 'Pearl (Moti)',
      days: 'Monday, Sunday',
      numbers: '1, 2, 7',
      direction: 'North-West',
      colour: 'White, Silver',
      planet: 'Moon',
      deity: 'Lord Krishna / Shiva',
      fast: 'Monday',
      dates: '2nd, 11th, 20th, 29th, 1st, 10th, 19th, 28th, 7th, 16th, 25th'
  },
  3: {
      radical: 'Radical Number 3',
      description: 'You are optimistic, creative, and communicative. You have a natural talent for teaching and self-expression.',
      sign: 'Sagittarius, Pisces',
      alphabets: 'C, G, L, S',               
      gemstone: 'Yellow Sapphire (Pukhraj)', 
      days: 'Thursday, Tuesday, Friday',
      numbers: '3, 6, 9',                    
      direction: 'North-East',
      colour: 'Yellow, Gold',
      planet: 'Jupiter',
      deity: 'Lord Vishnu / Brahma',
      fast: 'Thursday',
      dates: '3rd, 12th, 21st, 30th, 6th, 15th, 24th, 9th, 18th, 27th'
  },
  4: {
      radical: 'Radical Number 4',
      description: 'You are unconventional, practical, and hardworking. You often view the world from a unique perspective.',
      sign: 'Aquarius, Leo',
      alphabets: 'D, M, T',                  
      gemstone: 'Hessonite (Gomed)',
      days: 'Wednesday, Saturday, Monday',
      numbers: '1, 4, 7, 8',
      direction: 'South-West',
      colour: 'Blue, Grey',
      planet: "Rahu (Dragon's Head)",
      deity: 'Goddess Durga',
      fast: 'Saturday',
      dates: '4th, 13th, 22nd, 31st, 1st, 10th, 19th, 28th, 7th, 16th, 25th, 8th, 17th, 26th'
  },
  5: {
      radical: 'Radical Number 5',
      description: 'You are versatile, witty, and highly adaptable. You thrive on change and intellectual stimulation.',
      sign: 'Gemini, Virgo',
      alphabets: 'E, H, N, X',               
      gemstone: 'Emerald (Panna)',
      days: 'Wednesday, Friday',
      numbers: '1, 5',
      direction: 'North',
      colour: 'Green, Turquoise',
      planet: 'Mercury',
      deity: 'Lord Vishnu / Ganesha',
      fast: 'Wednesday',
      dates: '5th, 14th, 23rd, 1st, 10th, 19th, 28th'
  },
  6: {
      radical: 'Radical Number 6',
      description: 'You are charismatic, artistic, and responsible. You find fulfillment in beauty, harmony, and family life.',
      sign: 'Taurus, Libra',
      alphabets: 'U, V, W',                  
      gemstone: 'Diamond (Heera / Zircon)',
      days: 'Friday, Tuesday, Thursday',
      numbers: '3, 6, 9',
      direction: 'South-East',
      colour: 'White, Light Blue, Pink',
      planet: 'Venus',
      deity: 'Goddess Durga / Lakshmi',
      fast: 'Friday',
      dates: '6th, 15th, 24th, 3rd, 12th, 21st, 30th, 9th, 18th, 27th'
  },
  7: {
      radical: 'Radical Number 7',
      description: 'You are spiritual, intuitive, and analytical. You are a seeker of truth and prefer depth over superficiality.',
      sign: 'Pisces, Cancer',
      alphabets: 'O, Z',                     
      gemstone: "Cat's Eye (Lahsuniya)",
      days: 'Sunday, Monday',
      numbers: '1, 2, 4, 7',
      direction: 'North-East',
      colour: 'Multicolored, Sea Green',
      planet: "Ketu (Dragon's Tail)",
      deity: 'Lord Ganesha',
      fast: 'Thursday',                      
      dates: '7th, 16th, 25th, 1st, 10th, 19th, 28th, 2nd, 11th, 20th, 29th, 4th, 13th, 22nd, 31st'
  },
  8: {
      radical: 'Radical Number 8',
      description: 'You are disciplined, ambitious, and resilient. You understand the value of hard work and long-term planning.',
      sign: 'Capricorn, Aquarius',
      alphabets: 'F, P',                     
      gemstone: 'Blue Sapphire (Neelam)',
      days: 'Saturday, Friday',
      numbers: '4, 8',
      direction: 'West',
      colour: 'Black, Dark Blue',
      planet: 'Saturn',
      deity: 'Lord Shani / Hanuman',
      fast: 'Saturday',
      dates: '8th, 17th, 26th, 4th, 13th, 22nd, 31st'
  },
  9: {
      radical: 'Radical Number 9',
      description: 'You are courageous, energetic, and humanitarian. You have a strong fighting spirit and a desire to help others.',
      sign: 'Aries, Scorpio',
      alphabets: 'I, R',                     
      gemstone: 'Red Coral (Moonga)',
      days: 'Tuesday, Sunday, Thursday',
      numbers: '1, 3, 9',
      direction: 'South',
      colour: 'Red, Maroon',
      planet: 'Mars',
      deity: 'Lord Hanuman / Kartikeya',
      fast: 'Tuesday',
      dates: '9th, 18th, 27th, 1st, 10th, 19th, 28th, 3rd, 12th, 21st, 30th'
  }
};

@Injectable()
export class NumerologyService {
  constructor(private readonly settingsService: CompatibilitySettingsService) {}
  
  private reduceToSingle(num: number, master: boolean = true): number {
    if (master && (num === 11 || num === 22 || num === 33)) return num;
    while (num > 9) {
        num = num.toString().split('').reduce((acc, digit) => acc + parseInt(digit), 0);
    }
    return num;
  }

  calculateNumerology(name: string, dob: string) {
      if (!name || !dob) {
          throw new Error('Name and Date of Birth (YYYY-MM-DD) are required');
      }

      // Namaank (Name Number)
      const nameSum = name.toLowerCase().replace(/[^a-z]/g, '').split('').reduce((acc, ch) => acc + (CHALDEAN_MAP[ch] || 0), 0);
      const namaank = this.reduceToSingle(nameSum, false);

      // Bhagyaank (Life Path Number)
      const dateNumbers = dob.replace(/[^0-9]/g, '').split('').map(Number);
      const bhagyaank = this.reduceToSingle(dateNumbers.reduce((a, b) => a + b, 0), false);

      // Moolaank (Radical Number)
      const dayParts = dob.split('-')[2]; // assumes format YYYY-MM-DD
      const moolaank = dayParts ? this.reduceToSingle(parseInt(dayParts), false) : 0;

      // Extract details
      const moolaankDetails = NUM_DATA[moolaank] || null;
      const bhagyaankDetails = NUM_DATA[bhagyaank] || null;
      const namaankDetails = NUM_DATA[namaank] || null;

      return {
          namaank,
          bhagyaank,
          moolaank,
          inputName: name,
          inputDob: dob,
          details: moolaankDetails, 
          extendedDetails: {
              moolaank: moolaankDetails,
              bhagyaank: bhagyaankDetails,
              namaank: namaankDetails
          }
      };
  }

  async calculateNameCompatibility(n1: string, n2: string) {
    const compSettings = await this.settingsService.getSettings();
    
    const raw1 = n1.toLowerCase().replace(/[^a-z]/g, '').split('').reduce((acc, ch) => acc + (CHALDEAN_MAP[ch] || 0), 0);
    const raw2 = n2.toLowerCase().replace(/[^a-z]/g, '').split('').reduce((acc, ch) => acc + (CHALDEAN_MAP[ch] || 0), 0);
    
    const reduceToSingleLocal = (n: number) => {
        while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
            n = n.toString().split('').reduce((a, d) => a + parseInt(d), 0);
        }
        return n;
    };

    const num1 = reduceToSingleLocal(raw1);
    const num2 = reduceToSingleLocal(raw2);
    const key = [Math.min(num1, num2), Math.max(num1, num2)].join('-');
    
    // Priority: API Settings > Hardcoded Settings
    const adminScore = compSettings?.numerologyScores?.[key];
    const baseScore = adminScore ?? (NUM_COMPAT[key] || 70);

    const vowels = 'aeiou';
    const hd1 = reduceToSingleLocal(n1.toLowerCase().split('').filter(c => vowels.includes(c)).reduce((a, c) => a + (CHALDEAN_MAP[c] || 0), 0) || 1);
    const hd2 = reduceToSingleLocal(n2.toLowerCase().split('').filter(c => vowels.includes(c)).reduce((a, c) => a + (CHALDEAN_MAP[c] || 0), 0) || 1);
    
    const heartBonus = adminScore ? 0 : ((hd1 === hd2) ? 8 : (Math.abs(hd1 - hd2) <= 2 ? 4 : 0));
    const score = Math.min(99, Math.max(25, baseScore + heartBonus));

    let level = '', levelColor = '';
    if (score >= 90) { level = 'Divine Soulmate Bond'; levelColor = '#15803d'; }
    else if (score >= 80) { level = 'Powerful Vibrational Match'; levelColor = '#16a34a'; }
    else if (score >= 70) { level = 'Harmonious Connection'; levelColor = '#b8962e'; }
    else if (score >= 58) { level = 'Growing Bond'; levelColor = '#d97706'; }
    else { level = 'Contrasting Energies'; levelColor = '#dc2626'; }

    const getRashiFromName = (name: string) => {
        const firstLetter = name.trim().toLowerCase()[0];
        const rashiIdx = NAME_RASHI_MAP[firstLetter] ?? 0;
        return ZODIAC_SIGNS[rashiIdx];
    };

    const archetype1 = compSettings?.archetypes?.[num1] || NUM_ARCHETYPES[num1] || NUM_ARCHETYPES[9];
    const archetype2 = compSettings?.archetypes?.[num2] || NUM_ARCHETYPES[num2] || NUM_ARCHETYPES[9];
    const rashi1 = getRashiFromName(n1);
    const rashi2 = getRashiFromName(n2);

    const relationshipInsight = compSettings?.numerologyPairInsights?.[key] || 
                                NUM_INSIGHTS[key] || 
                                (score >= 80 ? `${n1} (${archetype1.title}) and ${n2} (${archetype2.title}) share a powerful vibrational harmony.` : 
                                 score >= 65 ? `${n1} (${archetype1.title}) and ${n2} (${archetype2.title}) carry complementary energies.` : 
                                 `${n1} (${archetype1.title}) and ${n2} (${archetype2.title}) carry contrasting vibrational energies.`);

    const challengeMap: Record<number, string> = { 1: 'Remember that vulnerability is strength, not weakness.', 2: 'Avoid over-giving — your needs matter equally.', 3: 'Channel restless energy into creative projects together.', 4: 'Allow space for spontaneity and emotional expression.', 5: 'Build shared routines that give the relationship an anchor.', 6: 'Avoid self-sacrifice — a healthy partnership needs two whole people.', 7: 'Open up emotionally — your partner cannot read your deep inner world.', 8: 'Express feelings verbally — actions alone may not feel like enough.', 9: 'Set boundaries — your compassion can sometimes overextend.' };
    const challenge = `${challengeMap[num1] || 'Stay open to your partner\'s perspective.'} ${challengeMap[num2] || 'Communicate openly and honestly.'}`;

    const heartDesire = Math.min(99, Math.max(30, ((hd1 + hd2) * 7) % 100 + 30));

    return {
        name1: n1, name2: n2,
        num1, num2,
        archetype1, archetype2,
        rashi1, rashi2,
        score, level, levelColor,
        heartDesire,
        relationshipInsight, challenge
    };
  }
}
