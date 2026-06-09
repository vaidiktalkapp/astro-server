import { Injectable } from '@nestjs/common';
import { ZODIAC_SIGNS, COMPAT_MATRIX, PAIR_INSIGHTS } from '../constants/compatibility.constants';
import { CompatibilitySettingsService } from '../../compatibility-settings/compatibility-settings.service';

@Injectable()
export class CompatibilityLogicService {
  constructor(private readonly settingsService: CompatibilitySettingsService) {}

  getZodiacFromDate(dateStr: string): number {
    if (!dateStr) return -1;
    const d = new Date(dateStr);
    const m = d.getMonth() + 1;
    const day = d.getDate();

    if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return 0;
    if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return 1;
    if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return 2;
    if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return 3;
    if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return 4;
    if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return 5;
    if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return 6;
    if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return 7;
    if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return 8;
    if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return 9;
    if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return 10;
    return 11;
  }

  async calculateCompatibility(idx1: number, idx2: number, name1: string, name2: string, isSunSign = false) {
    const compSettings = await this.settingsService.getSettings();
    
    const s1 = ZODIAC_SIGNS[idx1];
    const s2 = ZODIAC_SIGNS[idx2];
    const rawScore = COMPAT_MATRIX[idx1][idx2];
    const sameEl = s1.element === s2.element;
    const comp = ((s1.element === 'Fire' && s2.element === 'Air') || (s1.element === 'Air' && s2.element === 'Fire') ||
        (s1.element === 'Earth' && s2.element === 'Water') || (s1.element === 'Water' && s2.element === 'Earth'));

    const clamp = (v: number) => Math.max(28, Math.min(98, v));
    
    const pairKey = [Math.min(idx1, idx2), Math.max(idx1, idx2)].join('-');
    const specificPair = PAIR_INSIGHTS[pairKey];
    const ek = [s1.element, s2.element].sort().join('-');

    // --- Admin Overrides Integration ---
    const adminPair = compSettings?.pairInsights?.[pairKey];
    const adminElement = compSettings?.elementInsights?.[ek];
    
    // 1. Overall Score
    const overScore = adminPair?.score || adminElement?.score || rawScore;
    
    // 2. Level & Color
    let level = '', levelColor = '';
    if (overScore >= 90) { level = 'Soulmate Bond'; levelColor = '#15803d'; }
    else if (overScore >= 80) { level = 'Excellent Match'; levelColor = '#16a34a'; }
    else if (overScore >= 70) { level = 'Strong Connection'; levelColor = '#b8962e'; }
    else if (overScore >= 60) { level = 'Good Potential'; levelColor = '#d97706'; }
    else if (overScore >= 50) { level = 'Mixed Energy'; levelColor = '#ea580c'; }
    else { level = 'Challenging Bond'; levelColor = '#dc2626'; }

    // 3. Category Scores
    const adminCategories = adminPair?.categoryScores || adminElement?.categoryScores;
    const emotional = adminCategories?.emotional || clamp(overScore + (sameEl ? 8 : comp ? 5 : -3));
    const intellectual = adminCategories?.intellectual || clamp(overScore + (s1.element === 'Air' || s2.element === 'Air' ? 12 : comp ? 4 : -2));
    const physical = adminCategories?.physical || clamp(overScore + (s1.element === 'Fire' || s2.element === 'Fire' ? 10 : comp ? 5 : -2));
    const spiritual = adminCategories?.spiritual || clamp(overScore + (s1.element === 'Water' || s2.element === 'Water' ? 10 : sameEl ? 4 : -2));
    const communication = adminCategories?.communication || clamp(overScore + (s1.element === 'Air' || s2.element === 'Air' ? 14 : s1.element === 'Earth' && s2.element === 'Earth' ? 5 : -3));
    const romance = adminCategories?.romance || clamp(overScore + ((s1.ruling === 'Venus' || s2.ruling === 'Venus') ? 12 : (s1.element === 'Fire' || s2.element === 'Fire') ? 8 : 0));
    const longTerm = adminCategories?.longTerm || clamp(overScore + ((s1.element === 'Earth' || s2.element === 'Earth') ? 10 : sameEl && s1.element !== 'Fire' ? 6 : -2));

    const elementInsights: Record<string, { insight: string; chemistry: string; daily: string }> = {
        'Fire-Fire': { insight: `Two fire signs sharing ${s1.name} and ${s2.name}\u2019s bold energy create a passionate, high-octane partnership. Both are natural leaders who inspire each other to reach new heights. The key is channelling combined ambition into shared goals.`, chemistry: `Explosive and magnetic. Both are passionate and romantic in big gestures. The physical and emotional spark between you is natural and intense.`, daily: `Dynamic and rarely dull. Power struggles are possible, but the fire that creates clashes also creates passionate reconciliations. Life together is vivid and memorable.` },
        'Earth-Earth': { insight: `Two earth signs \u2014 grounded, practical, and genuinely committed. ${s1.name} and ${s2.name} share a deep appreciation for loyalty, stability, and building something lasting together. This is one of astrology\u2019s most reliable pairings.`, chemistry: `Slow-burning and deeply satisfying. The attraction grows steadily from mutual respect and shared values into a deeply comfortable, lasting warmth.`, daily: `Functional, organized, and pleasantly predictable. Both bring reliability and quality to shared life, creating a partnership that strengthens with every passing season.` },
        'Air-Air': { insight: `Two air signs whose minds dance together effortlessly. ${s1.name} and ${s2.name} share a love of ideas, communication, and social connection. Together they are mentally stimulating, socially vibrant, and endlessly interesting to each other.`, chemistry: `Light, charming, and intellectually electric. They fall in love over conversation and stay in love through constant mental stimulation.`, daily: `Lively and socially active. The challenge is building emotional depth beneath the intellectual brilliance to create a relationship that weathers all seasons.` },
        'Water-Water': { insight: `Two water signs in profound emotional resonance. ${s1.name} and ${s2.name} understand each other intuitively \u2014 often without words. The emotional depth they reach together is rarely accessed by other pairings.`, chemistry: `Deep, magnetic, and emotionally powerful. Both are highly sensitive and respond to each other with extraordinary empathy and intuitive understanding.`, daily: `Deeply intimate and private. Home is their sanctuary. Both should watch for emotional intensity becoming enmeshing \u2014 healthy independence strengthens the bond.` },
        'Fire-Air': { insight: `Fire and Air naturally energize each other. ${s1.name}\u2019s passion and ${s2.name}\u2019s intellect (or vice versa) create a stimulating partnership where ideas become action. This combination produces brilliant, adventurous energy.`, chemistry: `Playful, exciting, and fast-paced. Both bring spontaneity and optimism. The chemistry feels electric and youthful, with a natural enthusiasm for life together.`, daily: `Dynamic and engaging. Air brings ideas; Fire executes them. The challenge is slowing down to build emotional foundations beneath the exciting surface.` },
        'Earth-Water': { insight: `Earth and Water\u2019s most natural pairing in nature \u2014 one nurtures the other into growth. ${s1.name} and ${s2.name}\u2019s combination creates a deeply nurturing, emotionally secure, and practically stable partnership.`, chemistry: `Tender, warm, and quietly sensual. Both crave emotional safety, which they provide for each other with remarkable naturalness.`, daily: `Beautifully harmonious. Earth brings practical stability; Water brings emotional richness. Together they cover every dimension of a deeply fulfilling shared life.` },
        'Fire-Earth': { insight: `Fire\u2019s vision meets Earth\u2019s practicality in ${s1.name} and ${s2.name}\u2019s pairing. What one dreams, the other makes real. The dynamic requires patience, but the results can be remarkable.`, chemistry: `Building attraction that grows from fascination. Earth is intrigued by Fire\u2019s passion; Fire is grounded by Earth\u2019s warmth. The chemistry deepens as understanding grows.`, daily: `Fire leads with inspiration; Earth provides the follow-through. This can be a powerfully effective pairing when both appreciate what the other uniquely brings.` },
        'Air-Water': { insight: `Mind meets heart in ${s1.name} and ${s2.name}\u2019s pairing. Air brings logic, wit, and perspective; Water brings emotion, intuition, and depth. Bridging these two worlds creates a profoundly enriching partnership.`, chemistry: `Fascinating and emotionally complex. Air finds Water\u2019s emotional depth intriguing; Water is drawn to Air\u2019s brilliant mind. The attraction spans multiple dimensions.`, daily: `Requires conscious communication. Air needs to express emotions; Water needs to engage with ideas. When both make this effort, the partnership covers remarkable ground.` },
    };

    const elementFallback = elementInsights[ek] || elementInsights['Fire-Air'];
    const pairInsight = adminPair?.insight || adminElement?.insight || specificPair?.insight || elementFallback.insight;
    const chemistry = adminPair?.chemistry || adminElement?.chemistry || specificPair?.chemistry || elementFallback.chemistry;
    const daily = adminPair?.daily || adminElement?.daily || specificPair?.daily || elementFallback.daily;

    const sp: Record<string, string[]> = {
        'Fire-Fire': ['Explosive passion and shared high energy','Mutual respect for each other\'s independence','Inspiring each other to reach greater heights','Naturally adventurous and spontaneous dynamic','Deep understanding of each other\'s creative drive'],
        'Fire-Air': ['Intellectual stimulation meets bold action','Exceptional communication and natural spark','Shared enthusiasm for social energy and ideas','Air fans the flames of Fire\'s vision','Mutually supportive of individual freedom'],
        'Fire-Earth': ['Grounding stability meets creative inspiration','Practical support for ambitious big dreams','Complementary strengths that cover all bases','Earth provides the vessel for Fire\'s energy','Strong foundation build on mutual loyalty'],
        'Fire-Water': ['Emotional depth meets raw passion','Transformative and growth-oriented connection','Each brings what the other needs most spiritually','Deeply magnetic push-pull dynamic','Ability to catalyze profound personal change'],
        'Earth-Earth': ['Deep stability and unwavering lasting trust','Shared practical values and long-term ambitions','Building a beautifully secure and comfortable home','Exceptionally reliable and grounded partnership','Mutual appreciation for quality and tradition'],
        'Earth-Air': ['Balance of practical thought and creative ideas','Intellectual growth through healthy difference','Each broadens the other\'s worldly perspective','Stability meets mental agility and wit','Grounded approach to complex social dynamics'],
        'Earth-Water': ['Naturally nurturing and deeply devoted bond','Emotional security meets practical care','Seamless emotional and practical harmony','Water nourishes Earth while Earth provides structure','Exceptional potential for a lifelong partnership'],
        'Water-Water': ['Profound emotional resonance and understanding','Deep intuitive and wordless soul connection','Spiritual and emotional bonding at a high level','Total empathy for each other\'s inner world','Creating a private sanctuary of absolute trust'],
        'Water-Air': ['Emotional wisdom meets intellectual depth','Creative and meaningful soul-level conversations','Unique perspectives that enrich both lives','Bridge between subconscious and conscious thought','Gentle balance of logic and intuition'],
        'Air-Air': ['Constant mental stimulation and shared wit','Shared love of ideas, people, and discovery','Freedom-honouring partnership of true equals','Socially dazzling and intellectually vibrant','Endless topics for deep exploration together'],
    };
    
    const cp: Record<string, string[]> = {
        'Fire-Fire': ['Occasional ego clashes and leadership struggles','Impatience with each other\'s rapid pace','Burning out too quickly without grounding'],
        'Fire-Air': ['Inconsistency vs. impulsiveness in planning','Overthinking can sometimes dampen Fire\'s momentum','Scattered focus on too many ideas at once'],
        'Fire-Earth': ['Speed vs. caution creates regular friction','Deep-seated stubbornness on both sides','Earth may feel overwhelmed by Fire\'s intensity'],
        'Fire-Water': ['Emotional misunderstandings and different needs','Temperature differences in communication styles','Water may feel scalded or Fire may feel extinguished'],
        'Earth-Earth': ['Resistance to change and emotional expression','Shared routine can become too rigid or dull','Avoiding difficult emotional conversations'],
        'Earth-Air': ['Strict practicality vs. idealistic dreaming','Emotional detachment occasionally felt by Earth','Differing needs for physical vs. mental focus'],
        'Earth-Water': ['Over-sensitivity vs. pragmatic detachment','Possessive tendencies appearing on both sides','Resistence to leaving their safe comfort zone'],
        'Water-Water': ['Emotional overwhelm without external grounding','Difficulty setting healthy individual boundaries','Floating away in dreams without practical action'],
        'Water-Air': ['Rational vs. emotional processing of conflict','Mismatched needs for closeness vs. mental space','Communication gaps between logic and feelings'],
        'Air-Air': ['Lack of emotional and practical grounding','Too much intellectual talk and too little depth','Indecisiveness when both avoid making choices'],
    };

    const ap: Record<string, string> = {
        'Fire-Fire': 'Channel your combined fire into shared adventures and creative projects. Let each other lead in different domains \u2014 this is how competition becomes collaboration.',
        'Fire-Air': 'Keep the conversations deep and the adventures spontaneous. Ground your exciting ideas in shared experiences that build real emotional roots.',
        'Fire-Earth': 'Patience is the greatest gift you can give each other. The Fire partner brings the vision; the Earth partner makes it real. Trust the process.',
        'Fire-Water': 'Listen deeply before you react. Create emotional safety through consistency and follow-through. Fire warms Water; Water gives Fire its soul.',
        'Earth-Earth': 'Break routine intentionally. Plan adventures and surprises to keep the spark alive within your beautiful stability.',
        'Earth-Air': 'Listen to each other\'s perspectives with an open mind. Earth brings the logic, Air brings the vision \u2014 acknowledge both as valid and necessary.',
        'Earth-Water': 'Focus on building a shared sanctuary. Your bond is naturally deep, so prioritize quality time and emotional vulnerability.',
        'Water-Water': 'Ground your relationship in real-world shared activities. It\'s easy to get lost in the emotional deep end \u2014 stay connected to the physical world together.',
        'Water-Air': 'Practice expressing feelings (Water) and explaining logic (Air). Bridging the gap between head and heart is your greatest strength.',
        'Air-Air': 'Commit to turning your brilliant ideas into shared reality. Build practical routines that anchor your mental connection into a lasting daily life.',
    };

    const strengths = sp[ek] || sp['Fire-Air'];
    const challenges = cp[ek] || cp['Fire-Air'];
    const advice = ap[ek] || ap['Fire-Air'];

    return {
      score: overScore,
      sign1: s1,
      sign2: s2,
      name1: name1 || 'Person 1',
      name2: name2 || 'Person 2',
      level,
      levelColor,
      emotional,
      intellectual,
      physical,
      spiritual,
      communication,
      romance,
      longTerm,
      pairInsight,
      chemistry,
      daily,
      strengths,
      challenges,
      advice,
      isSunSign
    };
  }
}
