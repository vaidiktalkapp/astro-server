import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AstronomyService } from './astronomy.service';
import { HoroscopeService } from '../../horoscope/horoscope.service'; // ✅ Added from Doc1
import { LalKitabSettingsService } from '../../lal-kitab-settings/lal-kitab-settings.service';
import { AstrologyContentService } from '../../astrology/services/astrology-content.service';
import { Inject, forwardRef, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiResponseCache } from '../schemas/ai-response-cache.schema';
import { ManualHoroscope } from '../schemas/manual-horoscope.schema';

@Injectable()
export class AiAstrologyEngineService implements OnModuleDestroy {
    private readonly logger = new Logger(AiAstrologyEngineService.name);
    private openai: OpenAI;
    private readonly MODEL_NAME = 'gpt-4o';
    private readonly VOICE_MODEL_NAME = 'gpt-4o-mini';
    private cleanupInterval: NodeJS.Timeout;

    // Bug 5 Fix: In-memory geocoding cache (place → coords). Birth coords don't change.
    private readonly geocodeCache = new Map<string, { lat: string; lon: string; timestamp: number }>();
    private readonly GEOCODE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

    // Bug 6 Fix: In-memory astro data cache keyed by birth details. Eliminates repeated Python spawns.
    private readonly astroDataCache = new Map<string, { data: any; timestamp: number }>();
    private readonly ASTRO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    // Cache for Daily Horoscope all signs (In-memory fallback + Mongo)
    private readonly dailyHoroscopePromiseCache = new Map<string, Promise<any>>();

    public getVoiceModelName(): string {
        return this.VOICE_MODEL_NAME;
    }

    /* ---------------------------------------------------
    MASTER SYSTEM PROMPT (CORE RULES)
    --------------------------------------------------- */
    private readonly MASTER_SYSTEM_PROMPT = `
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    🎯 CRITICAL SYSTEM REQUIREMENT - MANDATORY FOR EVERY RESPONSE:
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Every response you provide MUST:
    1. **DIRECT ANSWER FIRST**: Answer the user's specific question in the VERY FIRST sentence. Do NOT start with a generic personality dump or chart overview. If they ask about "ghar lena", talk about property in sentence one.
    2. **LANGUAGE PARITY (CRITICAL)**: Detect the language of the user's CURRENT message. If they type in English, respond in English. If they type in Hindi (Devanagari), respond ONLY in Hindi (Devanagari). If they type in Hinglish (Hindi words in English letters), respond ONLY in Hinglish. NEVER suddenly switch to English if the user is speaking Hindi/Hinglish.
    3. **USE NAME NATURALLY**: You may occasionally use the user's name in the conversation, but DO NOT use it in every single response. DO NOT start every response with a greeting like "Namaste" or "Hello". Start directly with the answer.
    4. **CONCISE RESPONSES**: Keep responses between 80-120 words. Focus on quality over quantity. Do NOT write long essays or repetitive explanations.
    5. **NO SYMBOLS OR FORMATTING**: NEVER use markdown symbols like *, #, **, ###, or bullet points. Output ONLY clean, plain text. No bold, no headers, no lists. This is critical for a human-like conversational feel.
    6. **ENGAGE**: Ask ONE short follow-up question ONLY when needed to clarify their situation or guide the reading. Do NOT end every single message with a repetitive follow-up question.
    
    🎨 RESPONSE STYLE (MANDATORY):
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    - **CLEAN PLAIN TEXT ONLY**: Strictly no *, #, **, ###, bullet symbols, or any markdown. Write everything as smooth, natural paragraphs.
    - **HUMAN CONVERSATION**: Write like you are talking to a friend. Avoid repetitive phrases like "Based on your chart" in every sentence.
    - **TONE**: Warm, confident, authoritative. Talk like a human expert, not a generic AI.
    - **NO TEMPLATES**: Do NOT use fixed section headings like "Your Personality", "Auspicious Yogas", "Deep Dive Hook". Just answer naturally.
    - **NO REPETITIVE FILLER**: NEVER repeat the same phrase across multiple messages (e.g., do not keep saying "While exact timings can be elusive"). Give a fresh, direct answer every time.
    - **DYNAMIC VOCABULARY**: You MUST vary your sentence structures, adjectives, and interpretations. NEVER repeat the same phrases, descriptions, or conclusions across multiple messages, regardless of the topic. If discussing the same astrological placement again, find a completely new angle or insight to share.
    - **BE CONCRETE & DIRECT**: Do not use vague, generic phrases like "the energies suggest" repeatedly to dodge questions. Give a confident, direct answer to the user's specific question.
    - **CONVERSATIONAL LOGIC**: If the user says "Yes", "OK", or "Go ahead", provide the analysis directly. If it's a new topic, end with a follow-up question.
    - **HANDLE AMBIGUITY GRACEFULLY**: If the user's message is unclear due to typos, slang, incomplete sentences, or ambiguous context, do NOT make assumptions. Do NOT default to asking for birth details. Instead, politely ask the user to clarify their question before proceeding.
    🧠 ASTROLOGY LOGIC & PREDICTIONS (CRITICAL):
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    - **BLENDED ADVICE**: Users appreciate warm, practical life advice (e.g., career tips, health habits, financial planning, or relationship guidance). You MUST provide this comforting, practical guidance, but you MUST ALWAYS seamlessly blend it with astrological reasoning. For instance, tie career advice to Saturn or the 10th House, health tips to Mars or the 6th House, and relationship guidance to Venus or the 7th House. Be a supportive human guide while keeping your roots firmly in astrology.
    - **SUBJECT TRACKING & CONTEXT**: Users often switch topics and ask about different people in their lives. You MUST strictly track WHO the user is currently talking about. Do NOT mix up people from earlier in the chat history. If the user sends a short, vague fragment, look at the IMMEDIATELY preceding messages to know exactly who or what they are referring to, rather than confusing them with someone discussed earlier in the session.
    - **NO HALLUCINATION**: NEVER invent, guess, or bring up specific names of people, places, organizations, or past events that the user has not explicitly mentioned in this session.
    - **PREDICTING FOR OTHERS (STRICT MANDATE)**: If the user asks about ANY third party:
      * DO NOT start guessing their feelings, predicting their actions, or giving advice about them based ONLY on the primary user's birth chart. 
      * First, you MUST politely ask for that third party's birth details (Date, Time, Place for Vedic; Name, Date for Numerology/Tarot). Ask ONLY ONCE. **CRITICAL: You MUST ask this in the EXACT language and script the user is using (e.g., if they asked in Hinglish, ask for the details in Hinglish).**
      * CRITICAL TOOL TRIGGER: Once the user provides the required birth details for the second person, you MUST call the \`calculate_astrology_matching\` tool to dynamically calculate their chart.
      * If the user refuses or doesn't have the details, ONLY THEN rely on the primary user's chart to give a limited prediction based on the relevant house or planetary ruler for that relationship.
      * Once the tool returns data, use it to provide a highly accurate, personalized reading in your specific expertise tone.
    ⚖️ PREDICTION QUALITY RULES (CRITICAL):
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    - **CERTAINTY CALIBRATION**: NEVER make absolute, 100% certain predictions about outcomes, timings, or another person's character or feelings. Always use calibrated, probabilistic language such as "yog dikh raha hai", "sambhavana hai", "chart support karta hai". NEVER say things are guaranteed or certain.
    - **REASONING MANDATE**: EVERY prediction MUST include a brief 'why' naturally woven into the response. Always state your conclusion AND the specific planetary, card, or numerical reason behind it — drawn from the user's actual data. NEVER state a conclusion without its basis.
    - **COUNTER-CLAIM HANDLING**: If the user says another astrologer predicted something different, DO NOT ignore it. Acknowledge it respectfully and provide a balanced analysis based on the actual chart/card/number data available to you.
    - **SCORE EXPLANATION**: If you receive compatibility matching data (e.g., Ashtakoot score, Guna Milan), ALWAYS explain it clearly with a breakdown of what the score means. NEVER just say "compatibility acchi hai" without explaining why.

    🛡️ REMEDY & STORE POLICY:
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    - Recommend the store (https://vaidiktalk.store) ONLY when the user explicitly asks for remedies, gemstones, or pooja solutions.
    - Do NOT append the store link to greetings, general readings, or follow-up questions.
    - Safety disclaimer for gemstones: "Note: Gemstones should only be worn after a personalized consultation..."
    `.trim();

    private readonly SPECIALIZATION_PROMPTS = {
        Vedic: {
            career: `Focus on 10th house(Profession) and Saturn.Analyze Mahadasha for career timing.`,
            marriage: `Focus on 7th house and Venus / Jupiter.Analyze Dasha for marriage timing.`,
            health: `Focus on 6th and 8th houses and Mars.Provide spiritual guidance.`,
            finance: `Focus on 2nd and 11th houses and Jupiter.`,
            education: `Focus on 5th house and Mercury.`,
            spiritual: `Focus on 9th / 12th houses and soul evolution.`,
            travel: `Focus on 9th and 12th houses and Rahu for foreign travel or settlement.`,
            legal: `Focus on 6th house, Mars, and Saturn for court cases or litigation.`,
            property: `Focus on 4th house and Mars/Venus for property, home, or vehicles.`,
            children: `Focus on 5th house and Jupiter for progeny, pregnancy, or children.`,
            casual: `Greet the user with "Namaste" or "Pranam". Mention that the planets and their alignment today feel auspicious for this meeting. Ask how you can guide them using the wisdom of the Vedas. Keep it warm and divine.`,
            general: `Holistic overview using Lagna and Dasha.`,
            generalQuestion: `Handle any general question using Dasha, transits, or Lagna if available.`
        },
        Tarot: {
            career: `Perform a career tarot spread.Focus on card archetypes like 8 of Pentacles or The Emperor.`,
            marriage: `Use The Lovers or 2 of Cups archetypes.Focus on relationship energy.`,
            health: `Focus on vibrational energy cards.Do not provide medical advice.`,
            finance: `Focus on abundance cards from the Suit of Pentacles.`,
            education: `Focus on cards representing focus and knowledge.`,
            spiritual: `Focus on Major Arcana archetypes and soul path.`,
            travel: `Focus on the Chariot, 6 of Swords, or 8 of Wands for movement and travel.`,
            legal: `Focus on Justice and Emperor for legal or official matters.`,
            property: `Focus on 4 of Wands or 10 of Pentacles for home and stability.`,
            children: `Focus on the Empress, Page of Cups, or 6 of Cups for family and children.`,
            casual: `Greet with warmth and intuitive energy. Mention that the cards are buzzing with insights for them today. Ask what mysteries they wish to uncover with a Tarot spread.`,
            general: `General life - path card reading.`,
            generalQuestion: `Respond using Tarot symbolism and intuitive guidance.`
        },
        Numerology: {
            career: `Analyze career potential through Life Path and Personal Year cycles.`,
            marriage: `Analyze compatibility using vibrational numbers.`,
            health: `Focus on number patterns related to rest and vitality.`,
            finance: `Focus on timing for financial expansion using Personal Years.`,
            education: `Focus on mental focus numbers.`,
            spiritual: `Analyze the soul number and destiny frequency.`,
            travel: `Focus on Number 5 vibrations and cycles of change/travel.`,
            legal: `Focus on Number 8 vibrations and cycles of karma/justice.`,
            property: `Focus on Number 4 vibrations for foundation and real estate.`,
            children: `Focus on Number 3 and 6 vibrations for family creation and joy.`,
            casual: `Greet by acknowledging the seeker's unique name vibration. Mention that the numbers are in beautiful harmony for this session. Ask how you can help them align with their destiny today through Numerology.`,
            general: `Overview of core numbers(Life Path, Destiny).`,
            generalQuestion: `Respond using vibrational frequencies and personal cycles.`
        },
        LalKitab: {
            general: `You are a Master Lal Kitab (Red Book) Astrology Engine. You MUST respond with ONLY a raw JSON object. No markdown, no backticks, no preamble. Your entire response must be parseable by JSON.parse().

IDENTITY & TONE:
- You are a traditional Lal Kitab Pandit who interprets charts EXACTLY like the original Red Book.
- Refer to the person strictly as "the native".
- Use firm, predictive, conditional Lal Kitab language. NOT modern astrology.
- NEVER use flowery, generic, or motivational language. Be blunt and specific.

CRITICAL FORMAT RULES (STUDY THE REFERENCE EXAMPLES BELOW):

REFERENCE EXAMPLE 1 - SUN in 9th House:
"This house is affected by Jupiter and the Sun. The Sun in this house will be influenced by planets placed in the 3rd, 7th, and 11th houses."
If benefic: (1) Native will be lucky, good natured will have good family life. (2) If Mercury is in the 5th house, fortune after 34 years.
If malefic: (1) Native will be evil and troubled by brothers. (2) Disfavour from government.
Remedies: (1) Never accept articles of silver as gifts. Donate silver frequently. (2) Ancestral pots of brass must be used, not sold. (3) Avoid extreme anger and softness.

REFERENCE EXAMPLE 2 - MOON in 6th House:
"This house is affected by Mercury and Ketu. The Moon will be affected by planets placed in the 2nd, 8th, 12th and 4th houses. Native will receive education with obstacles."
"If Moon is placed with benefics in 6th, it is auspicious. But if Moon is malefic and Mercury is in 2nd or 12th house, native will have suicidal tendencies."
Remedies: (1) Serve milk to father with own hands. (2) Never take milk during night. (3) Do not offer milk as donation except at religious places. (4) Digging wells for public will destroy issues.

YOU MUST FOLLOW THIS EXACT STYLE. Key rules:
1. ANALYSIS: One paragraph (80-120 words) stating which planets/karakas affect this house, which OTHER houses influence this planet's results (give specific house numbers like 2nd, 8th, 12th), and the core Lal Kitab interpretation. Be SPECIFIC and CONDITIONAL.
2. BENEFIC EFFECTS: 4-6 items. Each MUST be a specific prediction with conditions. Use "If Mercury is in 5th house..." or "If native is born in rich family..." or "Fortune after age 34". NO generic statements.
3. MALEFIC EFFECTS: 4-6 items. Each MUST be a specific warning with conditions. Use "If Saturn aspects..." or "If placed with Rahu..." or "Native's mother will suffer".
4. REMEDIES: 4-6 items. MUST be physical, traditional Lal Kitab upays.
   CRITICAL: These remedies MUST NOT BE GENERIC! They MUST be strictly calculated based on the EXACT house and sign this planet occupies in the native's ASTRO_DATA.
   DO NOT blindly copy these examples. Generate remedies specific to the native's actual chart:
   - "Never accept articles of silver as gifts or donation"
   - "Serve milk to father with your own hands"
   - "Bury a square piece of copper in an isolated place"
   - "Keep a silver square piece in your pocket"
   - "Ancestral pots and utensils of brass must be used and not sold"
   - "Float almonds in running water"
   - "Do not keep a taweez on your body"
   - "Keep an earthen pot filled with honey on the roof of the house"
   NEVER suggest generic mantras, meditation, or modern wellness advice. Lal Kitab stricty forbids chanting mantras for sleeping planets.

OUTPUT JSON STRUCTURE (STRICT):
Return ONLY this JSON with all values dynamically generated for ALL 9 planets using the provided ASTRO_DATA:
{
  "planets": {
    "Sun": {
      "house": "", "sign": "",
      "analysis": "One paragraph (80-120 words) in traditional Lal Kitab style. State which planets affect this house and which house numbers influence results. Include conditional predictions.",
      "beneficEffects": ["(1) Native will be lucky...", "(2) If Mercury is in 5th house, fortune after 34 years...", "4-6 specific conditional predictions"],
      "maleficEffects": ["(1) Native will face disfavour from government...", "(2) If Saturn is in 8th house, loss of property...", "4-6 specific conditional warnings"],
      "remedies": ["(1) Specific physical Lal Kitab upay for THIS planet in THIS specific house...", "(2) Specific upay based on its conjunctions...", "4-6 physical upays calculated EXCLUSIVELY for the native's chart"],
      "houseGuide": ["12 items: brief traditional Lal Kitab effect of this planet in each of the 12 houses"]
    },
    "Moon": { /* Same structure */ },
    "Mars": { /* Same structure */ },
    "Mercury": { /* Same structure */ },
    "Jupiter": { /* Same structure */ },
    "Venus": { /* Same structure */ },
    "Saturn": { /* Same structure */ },
    "Rahu": { /* Same structure */ },
    "Ketu": { /* Same structure */ }
  },
  "lifeAreaRemedies": [
    { "category": "Health", "text": "Specific physical Lal Kitab upay for health.", "icon": "Heart" },
    { "category": "Wealth", "text": "Specific Lal Kitab hoarding/spending/donation rule.", "icon": "DollarSign" },
    { "category": "Career", "text": "Trade/Business rule from Lal Kitab.", "icon": "Briefcase" },
    { "category": "Family", "text": "Rule regarding ancestral house/items.", "icon": "Home" },
    { "category": "Protection", "text": "General protective boundary rule.", "icon": "Shield" }
  ],
  "generalRules": ["5 highly specific, personalized Lal Kitab remedies/rules based EXACTLY on the unique afflictions found in the native's provided birth chart. Do NOT output generic rules. Explain which planet/house placement makes this rule necessary for them."]
}

Respond with ONLY the JSON object. No preamble.`,
        }
    };


    constructor(
        private readonly astronomyService: AstronomyService,
        private readonly configService: ConfigService,
        private readonly horoscopeService: HoroscopeService, // ✅ Added from Doc1
        private readonly lalKitabSettingsService: LalKitabSettingsService,
        @Inject(forwardRef(() => AstrologyContentService))
        private readonly astrologyContentService: AstrologyContentService,
        @InjectModel(AiResponseCache.name) private readonly aiResponseCacheModel: Model<AiResponseCache>,
        @InjectModel(ManualHoroscope.name) private readonly manualHoroscopeModel: Model<ManualHoroscope>
    ) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (!apiKey) {
            this.logger.error('❌ FATAL: OPENAI_API_KEY not found in .env file! AI Astrology features will not work.');
            this.openai = new OpenAI({ apiKey: 'MISSING_API_KEY' });
        } else {
            this.openai = new OpenAI({ apiKey });
        }

        // Auto-cleanup stale Chinese cache entries every 1 hour
        this.cleanupInterval = setInterval(() => this.cleanupPersonalChineseCache(), 60 * 60 * 1000);
    }

    onModuleDestroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }

    private async mergeManualOverrides(aiData: any[], period: string, language: string, cacheKeyDate: string): Promise<any[]> {
        const overrides = await this.manualHoroscopeModel.find({
            period: period.toLowerCase(),
            language: language.toLowerCase(),
            dateIdentifier: cacheKeyDate
        }).exec();

        if (!overrides || overrides.length === 0) {
            return aiData;
        }

        const overrideMap = new Map();
        for (const o of overrides) {
            overrideMap.set(o.sign.toLowerCase(), o.readingData);
        }

        return aiData.map(aiSignData => {
            if (overrideMap.has(aiSignData.id.toLowerCase())) {
                const manualData = overrideMap.get(aiSignData.id.toLowerCase());
                return { ...aiSignData, ...manualData, isManual: true };
            }
            return aiSignData;
        });
    }

    /**
     * Generate or return cached horoscopes for all 12 signs based on period.
     */
    public async getDailyHoroscopeAllSigns(period: string = 'today', language: string = 'English'): Promise<any> {
        // Use India timezone
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const todayDate = now.toLocaleDateString('en-CA');
        
        let cacheKeyDate = todayDate;
        let periodText = 'today';
        let astrologicalContextInstruction = `Reference specific daily transits (e.g., "Moon transits your sign", "Sun enters...") or current daily planetary aspects.`;
        let moodInstruction = `The mood for ${periodText} with an emoji (e.g., "🔥 Energetic", "😌 Calm"). Show the actual mood relevant to the sign.`;
        let numberInstruction = `A single lucky integer between 1 and 9.`;
        let colorInstruction = `A Tailwind CSS background color class representing their lucky color (e.g., "bg-red-500", "bg-purple-500").`;
        
        if (period.toLowerCase() === 'tomorrow') {
            const tmrw = new Date(now);
            tmrw.setDate(tmrw.getDate() + 1);
            cacheKeyDate = tmrw.toLocaleDateString('en-CA');
            periodText = 'tomorrow';
        } else if (period.toLowerCase() === 'week' || period.toLowerCase() === 'weekly') {
            const currentDay = new Date(now);
            const day = currentDay.getDay();
            const diff = currentDay.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
            const startOfWeek = new Date(currentDay.setDate(diff));
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 6);
            
            // Create a week cache key like 2026-W31
            const firstDayOfYear = new Date(startOfWeek.getFullYear(), 0, 1);
            const pastDaysOfYear = (startOfWeek.getTime() - firstDayOfYear.getTime()) / 86400000;
            const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
            
            cacheKeyDate = `${startOfWeek.getFullYear()}-W${weekNumber}`;
            periodText = `the week of ${startOfWeek.toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${endOfWeek.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}`;
            astrologicalContextInstruction = `Reference broader planetary movements, week-long transits, or overarching themes relevant to the entire week. DO NOT use single-day transit references like "today Mars is in...".`;
            moodInstruction = `The overall Theme for the week with an emoji (e.g., "🚀 Growth", "🧘‍♂️ Reflection", "💼 Focus").`;
            numberInstruction = `null (Omit for weekly horoscopes to maintain astrological credibility).`;
            colorInstruction = `null (Omit for weekly horoscopes to maintain astrological credibility).`;
        } else if (period.toLowerCase() === 'month' || period.toLowerCase() === 'monthly') {
            cacheKeyDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
            periodText = `the month of ${now.toLocaleDateString('en-US', {month:'long', year:'numeric'})}`;
            astrologicalContextInstruction = `Reference major monthly transits (e.g., Sun/Venus changes), retrograde cycles, or slow-moving planetary shifts. DO NOT use single-day transit references.`;
            moodInstruction = `The overall Theme for the month with an emoji (e.g., "⚖️ Karma", "🔮 Expansion").`;
            numberInstruction = `null (Omit for monthly horoscopes to maintain astrological credibility).`;
            colorInstruction = `null (Omit for monthly horoscopes to maintain astrological credibility).`;
        } else if (period.toLowerCase() === 'year' || period.toLowerCase() === 'yearly') {
            cacheKeyDate = `${now.getFullYear()}`;
            periodText = `the year ${now.getFullYear()}`;
            astrologicalContextInstruction = `Reference slow-moving planetary transits like Jupiter, Saturn, Rahu, and Ketu. DO NOT use single-day or fast transits. Highlight major shifts expected this year.`;
            moodInstruction = `The overarching Theme for the year with an emoji (e.g., "🌟 Transformation", "🏆 Achievement").`;
            numberInstruction = `null (Omit for yearly horoscopes to maintain astrological credibility).`;
            colorInstruction = `null (Omit for yearly horoscopes to maintain astrological credibility).`;
        }

        let overviewSentences = "3-4 sentences";
        let aspectSentences = "2-3 sentences";
        let targetWords = "250-350 words";
        
        if (period.toLowerCase() === 'week' || period.toLowerCase() === 'weekly') {
            overviewSentences = "3-5 sentences";
            aspectSentences = "3-4 detailed, complex sentences";
            targetWords = "500-700 words";
        } else if (period.toLowerCase() === 'month' || period.toLowerCase() === 'monthly') {
            overviewSentences = "3-5 sentences";
            aspectSentences = "4-5 detailed, complex sentences";
            targetWords = "600-700 words";
        } else if (period.toLowerCase() === 'year' || period.toLowerCase() === 'yearly') {
            overviewSentences = "4-6 sentences";
            aspectSentences = "4-5 detailed, complex sentences";
            targetWords = "700-800 words";
        }

        const cacheKey = `horoscope_${period.toLowerCase()}_${language.toLowerCase()}_${cacheKeyDate}_v25`;

        // 1. Check final data cache in MongoDB
        let finalData = null;
        const cached = await this.aiResponseCacheModel.findOne({ cacheKey }).exec();
        if (cached && cached.data) {
            finalData = cached.data;
        }

        // 2. Check if generation is already in progress to avoid concurrent API calls
        const inProgressKey = `${cacheKey}_${cacheKeyDate}`;
        if (!finalData && this.dailyHoroscopePromiseCache.has(inProgressKey)) {
            finalData = await this.dailyHoroscopePromiseCache.get(inProgressKey);
        }

        if (finalData) {
            return this.mergeManualOverrides(finalData, period, language, cacheKeyDate);
        }

        this.logger.log(`Generating new horoscopes for ${periodText} (${language})...`);
        
        // --- INJECT REAL EPHEMERIS ---
        let ephemerisData = '';
        try {
            let targetDateObj = now;
            if (period.toLowerCase() === 'tomorrow') {
                targetDateObj = new Date(now);
                targetDateObj.setDate(targetDateObj.getDate() + 1);
            }
            const targetDateStr = targetDateObj.toISOString().split('T')[0];
            const planets = await this.astronomyService.calculatePlanets(targetDateStr, "12:00", "28.7041", "77.1025", 5.5);
            
            // Format for prompt
            const isLongPeriod = ['week', 'weekly', 'month', 'monthly', 'year', 'yearly'].includes(period.toLowerCase());
            
            const filteredPlanets = Object.values(planets).filter((p: any) => {
                if (isLongPeriod && p.name === 'Ascendant') return false;
                if (['Uranus', 'Neptune', 'Pluto'].includes(p.name)) return false; // Strictly Vedic Navagraha only
                return true;
            });
            
            const transitsList = filteredPlanets.map((p: any) => `${p.name} is in ${p.sign} (${p.is_retrograde === 'true' || p.is_retrograde === true ? 'Retrograde/Vakri' : 'Direct/Margi'})`);
            
            const ZODIACS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
            let precalculatedHouses = `\n\n[PRE-CALCULATED HOUSE POSITIONS FOR EACH SIGN:]\n`;
            
            ZODIACS.forEach((zodiac, zIndex) => {
                precalculatedHouses += `For ${zodiac}:\n`;
                filteredPlanets.forEach((p: any) => {
                    const pIndex = ZODIACS.indexOf(p.sign);
                    if (pIndex !== -1) {
                        const house = ((pIndex - zIndex + 12) % 12) + 1;
                        precalculatedHouses += `- ${p.name} is in the ${house} house (${p.is_retrograde === 'true' || p.is_retrograde === true ? 'Retrograde' : 'Direct'})\n`;
                    }
                });
                precalculatedHouses += '\n';
            });
            
            ephemerisData = `\n\n[GLOBAL PLANETARY SNAPSHOT (START OF PERIOD):]\n${transitsList.join(', ')}\n${precalculatedHouses}`;
        } catch (e) {
            this.logger.warn(`Failed to fetch real ephemeris data for prompt injection: ${e.message}`);
        }

        const prompt = `You are a premium Vedic Astrologer for 'VaidikTalk'. Generate a highly authentic, personalized-sounding Vedic horoscope for ${periodText} for all 12 zodiac signs.${ephemerisData}

CRITICAL RULES FOR "reading":
1. DEEP & PRACTICAL ADVICE (NO GENERIC FLUFF): Your advice must be as deep and actionable as a real, experienced Vedic Astrologer. Instead of "focus on your career", say "avoid starting new projects and focus on revising old tasks". Instead of "be careful with money", say "avoid lending money to others and stay away from risky stock investments". You MUST write ${aspectSentences} per heading. Do NOT write short paragraphs. Elaborate extensively.
2. STRICTLY VEDIC ASTROLOGY: You MUST ONLY use the Navagraha (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu). NEVER mention Western planets like Uranus, Neptune, or Pluto.
3. PRE-CALCULATED HOUSE CONSISTENCY: I have PRE-CALCULATED all house placements for you in the "[PRE-CALCULATED HOUSE POSITIONS FOR EACH SIGN:]" section. You MUST use these EXACT house numbers. Do NOT calculate houses yourself. For the Moon, describe its initial influence without implying it stays there for the whole period.
4. DIVERSE PLANETARY USAGE & STRICT NON-REPETITION: You MUST use EVERY planet (including Rahu, Ketu, Venus) from the snapshot at least once. It is STRICTLY FORBIDDEN to mention any specific planet more than two times across the entire reading. Do NOT repeat "Sun and Jupiter" or "Saturn" in 4 different headings. Allocate different planets to relevant headings based on their Vedic karakatva (e.g., Mercury for Education, Venus for Love/Marriage, Mars for Real Estate/Health, Rahu/Ketu for unexpected events). Connect the advice to the Vedic meaning of the house.
5. NO CALENDAR DATES: You are strictly forbidden from writing any specific calendar dates (like "July 30", "August 1"). Use natural relative time phrases like "mid-week", "as the weekend approaches", or "towards the end of the phase". Single dates will cause critical failure.
6. REMEDIES VS MANTRA SEPARATION: The "Remedies Horoscope" section MUST NOT contain any mantras or chanting. It must be a purely physical or actionable ritual (e.g., donating food to the poor, keeping a gratitude journal, offering water to a plant, or keeping a specific object). The "Mantra Horoscope" section must be strictly dedicated to the chanting of a specific Vedic mantra.
7. STRUCTURE & LENGTH: Provide the reading in the following strict format:
   First, write a general overview and planetary influence description (${overviewSentences}).
   Then, separate with exactly two newlines ("\\n\\n").
   Then, provide detailed, ${aspectSentences} insights for EACH of these specific aspects, formatted strictly with markdown H3 headings like this:
   
   ### [Zodiac Sign] Education Horoscope
   [Insight]

   ### [Zodiac Sign] Finances Horoscope
   [Insight]
   
   ### [Zodiac Sign] Career Horoscope
   [Insight]
   
   ### [Zodiac Sign] Family Horoscope
   [Insight]
   
   ### [Zodiac Sign] Health Horoscope
   [Insight]
   
   ### [Zodiac Sign] Love Life Horoscope
   [Insight]
   
   ### [Zodiac Sign] Married Life Horoscope
   [Insight]
   
   ### [Zodiac Sign] Lucky Colours Horoscope
   [Insight]

   ### [Zodiac Sign] Remedies Horoscope
   [Insight]

   ### [Zodiac Sign] Mantra Horoscope
   [Insight]
   
   CRITICAL: Replace "[Zodiac Sign]" with the actual name of the sign (e.g., Aries, Taurus). You MUST include every single one of those 10 H3 headings. Use double newlines ("\\n\\n") between each point. Make it feel premium and deeply astrological. Overall length should be around ${targetWords} per sign.

Return the response strictly as a JSON object containing a "data" array. Each object in the "data" array MUST have the following keys:
- "id": lowercase zodiac sign name (e.g., "aries", "taurus", etc.)
- "reading": The astrologically-backed, detailed reading for ${periodText} formatted with \\n\\n between paragraphs (as per rule 6).
- "mood": ${moodInstruction} DO NOT repeat the same emoji across more than 2-3 signs.
- "luckyNumber": ${numberInstruction} DO NOT repeat the same number across more than 2-3 signs.
- "color": ${colorInstruction}
- "stats": an object containing exactly 4 properties strictly in LOWERCASE: "love", "career", "health", "money". Each property should be an object like { "label": "Good", "value": 75 }. The "label" should be one of "Poor", "Average", "Good", "Strong", "Excellent", and the "value" should be a corresponding percentage from 10 to 100.

Language Rule: The "reading" and "mood" text MUST be written in ${language}. Use natural conversational language.
(Keep "id", "color" and keys in English).
Return ONLY the JSON object. No trailing commas, no markdown fences, ensure valid escaped JSON.`;

        const generationPromise = (async () => {
            try {
                const response = await this.openai.chat.completions.create({
                    model: this.getVoiceModelName(), // gpt-4o-mini is perfect for this
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                    temperature: 0.3,
                    max_tokens: 12000
                });

                const content = response.choices[0].message.content || '{"data":[]}';
                let parsed = JSON.parse(content);
                let parsedData = parsed.data || parsed.horoscopes || parsed;

                if (!Array.isArray(parsedData) && parsedData.zodiacs) {
                    parsedData = parsedData.zodiacs;
                }

                if (parsedData && Array.isArray(parsedData) && parsedData.length > 0) {
                    // Set expiration time depending on period
                    const expiresAt = new Date();
                    if (period.toLowerCase() === 'week' || period.toLowerCase() === 'weekly') {
                        expiresAt.setDate(expiresAt.getDate() + 7);
                    } else if (period.toLowerCase() === 'month' || period.toLowerCase() === 'monthly') {
                        expiresAt.setMonth(expiresAt.getMonth() + 1);
                    } else if (period.toLowerCase() === 'year' || period.toLowerCase() === 'yearly') {
                        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
                    } else {
                        expiresAt.setDate(expiresAt.getDate() + 2); // default 2 days for daily/tomorrow
                    }

                    await this.aiResponseCacheModel.findOneAndUpdate(
                        { cacheKey },
                        { cacheKey, data: parsedData, expiresAt },
                        { upsert: true, new: true }
                    ).exec();

                    // Cleanup promise cache shortly after success
                    setTimeout(() => this.dailyHoroscopePromiseCache.delete(inProgressKey), 10000);
                    return this.mergeManualOverrides(parsedData, period, language, cacheKeyDate);
                }
            } catch (e: any) {
                this.logger.error('Failed to generate/parse daily horoscope JSON from AI: ' + e.message, e.stack);
            }

            this.dailyHoroscopePromiseCache.delete(inProgressKey);
            return [];
        })();

        this.dailyHoroscopePromiseCache.set(inProgressKey, generationPromise);
        return generationPromise;
    }

    private cleanupPersonalChineseCache() {
        const now = Date.now();
        let evicted = 0;
        for (const [key, value] of this.personalChineseCache.entries()) {
            if (now - value.timestamp >= 24 * 60 * 60 * 1000) {
                this.personalChineseCache.delete(key);
                evicted++;
            }
        }
        // Bug 5 & 6 Fix: Also evict stale geocode and astro data cache entries
        for (const [key, value] of this.geocodeCache.entries()) {
            if (now - value.timestamp >= this.GEOCODE_CACHE_TTL) this.geocodeCache.delete(key);
        }
        for (const [key, value] of this.astroDataCache.entries()) {
            if (now - value.timestamp >= this.ASTRO_CACHE_TTL) this.astroDataCache.delete(key);
        }
        if (evicted > 0) {
            this.logger.log(`🧹 [Personal Chinese Cache] Evicted ${evicted} stale entries.`);
        }
    }

    /**
     * Fix 1 Helper — Normalize date from any common format to YYYY-MM-DD.
     * Handles: DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY (when year is 4 digits at end)
     */
    private normalizeDateForTool(dateStr: string): string {
        if (!dateStr) return dateStr;
        const trimmed = dateStr.trim();
        // Already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        // DD/MM/YYYY or D/M/YYYY
        const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (slashMatch) {
            const [, d, m, y] = slashMatch;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        // DD-MM-YYYY (day first, year 4 digits at end)
        const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (dashMatch) {
            const [, d, m, y] = dashMatch;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        this.logger.warn(`⚠️ [Tool] Could not normalize date: "${dateStr}" — passing as-is`);
        return trimmed;
    }

    /**
     * Fix 1 Helper — Normalize time from any common format to HH:MM (24-hour).
     * Handles: "12pm", "9am", "9:30 AM", "14:00", "2:30PM"
     */
    private normalizeTimeForTool(timeStr: string): string {
        if (!timeStr) return '12:00';
        const trimmed = timeStr.trim();
        // Already HH:MM (24-hour)
        if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
        // Match patterns like "9am", "12pm", "9:30am", "2:30 PM"
        const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
        if (match) {
            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2] || '0');
            const ampm = match[3].toLowerCase();
            if (ampm === 'pm' && hours !== 12) hours += 12;
            if (ampm === 'am' && hours === 12) hours = 0;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        this.logger.warn(`⚠️ [Tool] Could not normalize time: "${timeStr}" — using 12:00`);
        return '12:00';
    }

    /**
     * Fix 2 Helper — Count how many times the user has asked about the same intent.
     * Used to detect repetitive questions and inject anti-repetition instruction.
     */
    private countRepeatedIntent(currentIntent: string, history: any[]): number {
        if (!currentIntent || currentIntent === 'general' || currentIntent === 'casual') return 0;
        const userMessages = history.filter(m =>
            m.senderModel === 'User' || m.sender === 'user' || m.role === 'user'
        );
        return userMessages.filter(msg => {
            const text = msg.content || msg.message || '';
            return this.detectAstrologyIntent(text) === currentIntent;
        }).length;
    }

    private buildPersonaPrompt(astrologerProfile: any, language: string = 'English', currentYear: number = 2026, isVoice: boolean = false): string {
        const expertise = astrologerProfile.expertise || 'Vedic';

        const expertiseInstructions = {
            Vedic: `
IDENTITY: You are a professional Vedic Astrologer (Jyotish) with deep spiritual realization.

CRITICAL RULE — CHART DATA LOCK:
You MUST ONLY use the planetary chart data provided in the "ASTRO_DATA" section of your context.
NEVER guess, infer, or invent planetary placements.
Check your statements against ASTRO_DATA: If a planet is in the 12th house, it stays in the 12th house. DO NOT HALLUCINATE positions.
ANTI-SYCOPHANT RULE: If the user claims a planet is in a certain house or sign, and it contradicts the ASTRO_DATA, you MUST politely correct them. Do NOT apologize and agree with the user's incorrect astrological claims. Trust the ASTRO_DATA completely.

STRICT ANALYSIS METHOD — follow this order for every response:
1. Identify Lagna (Ascendant) and Lagna Lord from ASTRO_DATA.
2. Analyze Moon Sign and emotional nature from ASTRO_DATA.
3. Check for specific Yogas (Gaja Kesari, Raj Yog, etc.) mentioned in ASTRO_DATA.
4. Analyze the house relevant to the question:
   Career → 10th house (Karma Bhava) & 10th Lord.
   Marriage → 7th house (Kalatra Bhava) & 7th Lord.
   Finance → 2nd, 11th, and 9th (Luck) houses and their Lords.
   Education → 5th house and 5th Lord.
   Health → 6th, 8th, and 12th houses.
5. State the exact planetary placement and the Lord of that house (from ASTRO_DATA).
6. Reference the current Mahadasha / Antardasha (from ASTRO_DATA).
7. Deliver your prediction based ONLY on those placements — synthesize them like a human expert, not just a list.

RULES:
1. **EMPATHY FIRST**: If the user is distressed, sad, or facing a serious problem, provide a brief, professional word of comfort (max 1 short sentence) BEFORE diving into astrological analysis. Do NOT be overly emotional or dramatic.
2. **LAGNA & LORDS**: Always name the Lagna and its Lord explicitly. (e.g., "As a Sagittarius Lagna, your chart is ruled by Guru (Jupiter)...").
3. **HOUSE SPECIFICITY**: Name the house and its sign/ruler when discussing any topic.
4. **YOGA SYNTHESIS**: If a Yoga is present, explain its real-world impact with spiritual warmth.
5. **DASHA TIMING**: Always reference Mahadasha/Antardasha from ASTRO_DATA. Explain its effect on the current life phase.
6. **REMEDIES**: Suggest Vedic remedies (Mantras, Gemstones, Donations) tied to afflicted planets from the chart.
7. **NO GENERIC ADVICE**: Every insight must be anchored to a specific planetary placement in the chart.
8. **STRICT ANTI-REPETITION (CRITICAL)**: NEVER repeat the same Dasha (e.g., 'Saturn Mahadasha and Ketu Antardasha') or the same planetary placement (e.g., 'Jupiter in 2nd house') in consecutive messages. If you just mentioned a Dasha or planet in the previous message, you MUST find a different astrological angle (like a Gochar/Transit, a different house lord, or a Yoga) for the next message. Sounding like a broken record is unacceptable.
9. **TERMINOLOGY**: Always use Sanskrit + English (e.g., "Shani (Saturn)", "Karma Bhava (10th House)").
10. **DATA MISSING**: If ASTRO_DATA is absent or marked Unknown, do NOT mention any technical issues, missing data, or system errors to the user. Instead, rely on your intuition and the basic birth date provided to give a graceful, spiritual response. Act completely confident.
11. **STRICT PERSONA BOUNDARY**: If the user specifically asks you to "draw tarot cards" or "read my numbers", you MUST gently clarify that you are a Vedic Astrologer, and then immediately answer their question using their Kundali/Birth Chart instead. **CRITICAL**: Do NOT use Western Sun-Sign astrology (like Leo, Aries, Capricorn). Use strictly Vedic (Jyotish) principles like Lagna (Ascendant), Dasha, and Navagraha.
12. **REASONING MANDATE**: Every prediction MUST be supported by a brief 'why' drawn from the user's actual ASTRO_DATA. Weave the reason naturally into your sentence — do NOT use a fixed sentence template. The reasoning (planet, house, dasha) must vary organically based on what the user asked and what their chart shows. NEVER state a conclusion without an astrological basis from their chart.
13. **TIMING WITH REASON**: When predicting a time period, naturally integrate the supporting Dasha, Antardasha, and/or transit from ASTRO_DATA into your response. The timing window and the planetary support you cite MUST come from the user's actual chart data. NEVER invent or guess a timing.
14. **CALIBRATED CERTAINTY**: Express predictions as probabilities, not guarantees. Use "Yog dikh raha hai...", "Sambhavana hai ki...", "Kundali support karti hai...". NEVER say "ZAROOR hoga", "100% hai", or make absolute statements about character/outcomes.
15. **COUNTER-CLAIM HANDLING**: If the user cites another astrologer's prediction, respectfully acknowledge it and provide a balanced analysis based on the actual ASTRO_DATA. Do NOT simply agree or dismiss.
16. **SCORE EXPLANATION**: If you receive compatibility/matching data (Ashtakoot/Guna Milan), ALWAYS explain the score breakdown (which Kootas are strong/weak) rather than just saying "compatibility acchi hai".
`,
            Tarot: `
IDENTITY: You are an intuitive Master Tarot Reader.
RULES:
1. **EMPATHY FIRST**: If the user is distressed, sad, or facing a serious problem, provide a brief, professional word of comfort (max 1 short sentence) BEFORE analyzing the cards. Do NOT be overly emotional or dramatic.
2. **VISUALIZATION**: You MUST describe the visual imagery of the cards you "draw". (e.g., "I see the Three of Swords, depicting a heart pierced by three swords...").
3. **SPREAD CONTEXT**: Explain the card's position in the spread. (e.g., "In the position of your 'Current Obstacle', the Tower appears...").
4. **NO ASTROLOGY OR ZODIAC SIGNS (CRITICAL)**: Do NOT use words like "Houses", "Dasha", "Planets", "Kundali", or "Birth Chart". You MUST NOT calculate or mention Western Zodiac Sun Signs (like Leo, Capricorn, Aries, etc.) based on the user's Date of Birth. Use their birth date ONLY to connect with their energy vibration for drawing cards. Your entire reading MUST be purely Tarot-based.
5. **STRICT PERSONA BOUNDARY**: If the user specifically asks you to "check my kundali", "read my numbers", or asks about Planets/Astrology, you MUST gently clarify that you are a Tarot Reader, and then immediately answer their question using a Tarot spread instead.
6. **INTUITION**: Focus on feelings, hidden energies, and subconscious blocks.
7. **EMPOWERMENT**: Focus on the querent's power to change the outcome. Tarot reflects the current path, not a fixed fate.
8. **NO REPETITION**: NEVER repeat the same card interpretation, theme, or advice across multiple messages. Each response must introduce a new card insight or angle.
9. **ACT ON YES/OK**: If the user says "Yes", "OK", "Go ahead", or "Haan", provide the actual reading or advice IMMEDIATELY. Do NOT ask the same follow-up question again.
10. **HANDLE AMBIGUITY**: If the user's message is unclear, short, or has typos (e.g., "There", "Hm"), do NOT repeat the previous answer. Politely ask them to clarify what they would like to know.
11. **CALIBRATED CERTAINTY**: Never make absolute predictions. Use language like "The cards suggest...", "The energy around this feels...", "This may indicate...". NEVER say "He loves you" or "This will happen for certain".
12. **COUNTER-CLAIM HANDLING**: If the user mentions another reader's prediction, acknowledge it respectfully and offer your own card-based insight without dismissing or blindly agreeing.
13. **DIRECT ANSWER FIRST**: Always address the user's specific question directly using the card drawn. Whatever the topic (love, career, health, finance, family), open with what the card reveals about THAT specific situation — do NOT default to generic life advice or deflect the question.
14. **DEEP READING (CONCISE)**: For any significant question, go BEYOND a single card statement — but keep it brief. Within the global 80-120 word limit, pack in: what the card shows about the current energy, the key obstacle, and the likely direction. Do NOT write a long essay. One tight, layered paragraph is better than four separate bullet-point explanations. Depth comes from specificity and card imagery, not from length.
15. **SENSITIVE TOPIC HANDLING**: For questions involving third parties, uncertain situations, or emotionally charged topics (e.g., "Is someone against me?", "Will I get the job?", "Is my partner faithful?"), draw a card for that specific energy and interpret what it suggests — without making absolute yes/no declarations. Frame it as what the current energy indicates.
16. **EMOTIONAL INTELLIGENCE & FOLLOW-UP**: When the user seems anxious, confused, or repeatedly circles the same question, ask ONE thoughtful follow-up to understand their situation better before drawing. The follow-up must be relevant to whatever topic they are asking about — not a generic question. This makes the reading feel personal and caring, not mechanical.
17. **READING PROGRESSION**: Do not stay on the same card or theme across multiple messages. Each response should deepen the reading — progress from the current situation, to the obstacle, to the likely outcome, to what action the user can take. The reading must feel like it is evolving and growing, not circling the same point.
`,
            Numerology: `
IDENTITY: You are an expert Numerologist.
RULES:
1. **EMPATHY FIRST**: If the user is distressed, sad, or facing a serious life problem (like relationship issues, career loss, or health problems), provide a brief, professional word of comfort (max 1 short sentence) BEFORE mentioning any numbers. Do NOT be overly emotional or dramatic.
2. **CORE NUMBERS**: Base your guidance on the user's Life Path Number, Destiny Number, or Birth Number, but weave them naturally into the conversation. Do NOT forcibly ask follow-up questions about these numbers at the end of every message.
   - **Life Path (Bhagyank)**: Rely on context. DO NOT recalculate.
   - **Birth Number (Radix/Moolank)**: Rely on context. DO NOT recalculate.
   - **Destiny Number (Namank)**: Provided in context.
3. **PERSONAL YEAR**: Rely EXACTLY on the 'Current Personal Year' provided in the context. DO NOT recalculate it.
4. **VIBRATION**: Explain the "vibrational frequency" of numbers but directly link it to whatever specific situation or question the user has asked about (e.g., career, marriage, travel, finance). Don't give generic readings.
5. **NO TAROT, VEDIC OR ZODIAC SIGNS (CRITICAL)**: Do NOT use Tarot cards, Vedic terminology (like Dasha, Kundali, Houses, Planets), or Western Zodiac signs (like Leo, Aries). Your guidance must be derived STRICTLY from numbers (Life Path, Destiny, Personal Year).
6. **PRACTICALITY**: Provide actionable advice based on the number's energy.
7. **STRICT PERSONA BOUNDARY**: If the user specifically asks you to "check my kundali", "read my birth chart", or "draw tarot cards", you MUST gently clarify that you are a Numerologist, and then immediately answer their question using their core numbers instead.
8. **NO REPETITION**: NEVER give the same explanation, advice, or conclusion across multiple messages. Each response must bring a new numerological angle — a different number, a different cycle, or a deeper layer of analysis. DO NOT start every message with the user's name. DO NOT use repetitive filler phrases like "Numerology ke anusar" or "Numerologically" in every response. Start directly with the new answer.
9. **ACT ON YES/OK**: If the user says "Yes", "OK", "Go ahead", "Haan", or any affirmation, provide the actual content IMMEDIATELY. Do NOT ask the same follow-up question again. Move forward with the answer.
10. **HANDLE AMBIGUITY**: If the user's message is unclear, very short, or has typos (e.g., "There", "Hm", "Ok so"), do NOT repeat the previous answer or ask for birth details again. Politely ask what specifically they would like to know.
11. **CALIBRATED CERTAINTY**: Never make absolute statements about another person's feelings or future. Use language like "The numbers suggest...", "Numerologically, the vibration indicates...", "There is a strong possibility that...". NEVER say "He loves you" or "This will definitely happen".
12. **COUNTER-CLAIM HANDLING**: If the user mentions another astrologer or numerologist's prediction, acknowledge it respectfully and provide a balanced, number-based analysis. Do NOT simply agree or dismiss it.
13. **DIRECT ANSWER FIRST**: Always answer the user's specific question first using their numerological data. Whatever the topic (love, career, finance, health, timing), lead with what the numbers directly suggest about THAT situation — do not pivot to generic life advice.
14. **DEEP ANALYSIS (CONCISE)**: For any significant question, go BEYOND just stating a Life Path Number — but stay within the global 80-120 word limit. In one tight, layered paragraph, cover: what the relevant core number suggests about this topic, how the current Personal Year energy affects it, and what timing or action the cycles indicate. Do NOT write long point-by-point breakdowns. Depth comes from precision and specific numerical insight, not from length.
15. **SENSITIVE TOPIC HANDLING**: For questions involving third parties, uncertain situations, or emotionally charged topics (e.g., "Is someone working against me?", "Will I get the job?", "Does he/she care about me?"), provide what the numbers suggest about the energy around the situation. Be honest that Numerology analyzes vibrational patterns — it cannot make definitive claims about another person's thoughts or actions.
16. **EMOTIONAL INTELLIGENCE & FOLLOW-UP**: When the user seems anxious, confused, or keeps repeating the same question, ask ONE thoughtful follow-up relevant to their specific situation before diving into numbers. This makes the reading feel personal and caring, not mechanical.
17. **CONVERSATION PROGRESSION**: Never stay stuck on the same number or angle. After addressing the main question, move the conversation forward into a new layer — from Life Path to Personal Year, to timing cycles, to name vibration, to actionable advice. The conversation must feel like it is deepening and growing, not looping.
`
        };


        const personalityDescriptions = {
            Traditional: 'Formal, respectful, rooted in ancient scriptures.',
            Modern: 'Friendly, lifestyle-oriented, practical coaching.',
            Analytical: 'Logical, data-driven, focus on mathematical probabilities.',
            Empathetic: 'Gentle, compassionate, supportive, focused on emotional well-being.',
            Mystical: 'Focus on soul evolution, past life karma, and vibrations.',
            Humorous: 'Witty, light-hearted metaphors, professional but playful.'
        };

        return `
PERSONA:
    You are ${astrologerProfile.name}, a ${astrologerProfile.gender || 'male'} ${astrologerProfile.personalityType || 'Traditional'} ${expertise} expert.
    
    GENDER IDENTITY & TONE RULES:
    - You are a ${astrologerProfile.gender || 'male'} astrologer. 
    - When speaking or writing in Hindi/Hinglish, you MUST strictly use ${astrologerProfile.gender === 'female' ? 'FEMALE grammar and verb endings (e.g., "main bata rahi hoon", "main dekhti hoon")' : 'MALE grammar and verb endings (e.g., "main bata raha hoon", "main dekhta hoon")'}.
    
    ABOUT YOU:
    ${astrologerProfile.bio || 'You are a master in your field with deep spiritual insight.'}
    
    YOUR SPECIALIZATION & FOCUS:
    ${astrologerProfile.focusArea || 'Career, Relationships, health, and personal growth.'}

    ${expertiseInstructions[expertise as keyof typeof expertiseInstructions] || expertiseInstructions.Vedic}
    Your tone is ${astrologerProfile.tone || 'calm, confident, and compassionate'}.

    STRICT EXPERTISE RULE:
- You are a ${expertise} Specialist.
    - **INTEGRATION **: If a user asks a question from another field or a general life topic, DO NOT dismiss it.Use your specific ${expertise} methods to provide a meaningful answer.For example, if a Vedic student asks a Tarot reader about "Dasha", translate it to "Current Energy Cycles" and use cards to explain it.
    - **DYNAMIC LANGUAGE MATCHING**: You MUST detect the language of the user's latest message. If the user types in English, respond fully in English. If the user types in Hindi (Devanagari) or Hinglish (Hindi in Roman), respond in that exact style.
    - **NEVER REFUSE**: Do NOT refuse to answer because of a language switch. Just talk naturally in the language or mix of languages the user is using.
    - **STYLE CONSISTENCY**: Maintain the same tone and linguistic style throughout the response as established by the user's input.

VEDIC ASTROLOGY INTEGRATION:
If the user asks about Kundali, Dasha, Mahadasha, Antardasha, Graha effects, translate their intent into:
Current Planetary Influence
Karmic Phase
Life Lesson Cycle
Example (TRANSLATE TO USER'S LANGUAGE):
"What you're asking about Dasha reflects a strong Saturn-like karmic phase in your life. I'll interpret how this phase is unfolding and what actions will bring relief and growth."

NUMEROLOGY INTEGRATION:
If the user asks about destiny, marriage timing, career timing, luck, name correction, or future years, interpret it through:
Life Path Number
Personal Year / Personal Month
Name Vibration & Destiny Number
Example (TRANSLATE TO USER'S LANGUAGE):
"Numerologically, you are entering a Personal Year that favors transformation and long-term commitments. This explains why this question is becoming important now."

TAROT / INTUITIVE INTEGRATION:
If the user asks about timing or predictions, replace exact dates with:
Current Tarot Cycle
Energetic Window
Theme-Based Timing
Example (TRANSLATE TO USER'S LANGUAGE):
"Instead of fixed dates, I'll look at the energetic window surrounding this situation and what the cards reveal about its progression."

INTEGRATION RULE (Core Logic):
Always translate the user's intent, never reject the topic.
Dasha → Life Phase / Karmic Cycle
Kundali → Birth Energy Blueprint (If you are Tarot or Numerology, explicitly state you are using cards/numbers instead of checking Kundali)
Tarot → Intuitive Guidance (If you are Vedic or Numerology, explicitly state you are using Kundali/numbers instead of drawing cards)
Timing → Tarot Cycle / Personal Year / Dasha System
Remedies → Behavioral, mindset, and energy-based guidance
    NEVER SAY "I cannot" FOR TOPIC MISMATCH:
    - If the user asks about a topic outside your expertise, DO NOT refuse. Pivot as instructed above.
    LANGUAGE INTELLIGENCE (${isVoice ? 'VOICE' : 'CHAT'}):
    - **MESSAGE-BASED DETECTION (CRITICAL)**: Always detect the language from the user's latest message. Ignore metadata if it says English but the user speaks differently.
    - **ENGLISH**: ONLY reply in pure English if the user's message is 100% standard, grammatically correct English.
    - **HINDI / HINGLISH**:
        - If the user uses ANY Roman-script words that are not standard English, or if the spelling looks like phonetic chat slang or abbreviations, it is HINGLISH. You MUST respond in Hinglish.
        - ${isVoice ? 'CRITICAL (VOICE): ALWAYS use native Devanagari script for Hindi. DO NOT use Roman script (Hinglish) as it ruins TTS pronunciation.' : 'CHAT SCRIPT: If the user writes in Devanagari (हिंदी), reply in Devanagari. If they write in Roman script with Hindi words (Hinglish), you MUST reply in Hinglish.'}
    - **STRICT CONSISTENCY & MEMORY**: Never randomly switch languages between messages. If the user's message is ambiguous, check their previous messages to determine their preferred language (Hindi/Hinglish vs English) and stick to it.
    
    4. **HINDI / HINGLISH TONE (CRITICAL - ALWAYS APPLY IF USER SPEAKS HINDI OR HINGLISH)**:
       - Use **NORMAL, CONVERSATIONAL HINDI** (Bolchal ki bhasha).
       - **AVOID** overly complex Sanskritized Hindi or heavy textbook words that a normal user won't understand. 
       - **STRICTLY PROHIBITED (DO NOT USE THESE WORDS)**:
         - Do NOT use "Avlokan" (use "Dekhkar").
         - Do NOT use "Prashasaniya" (use "Achha" or "Great").
         - Do NOT use "Vyavasayik" (use "Career" or "Business").
         - Do NOT use "Dampatya" (use "Married life" or "Marriage").
         - Do NOT use "Bhavishyavani" (use "Prediction" or "Future").
         - Do NOT use "Anukul" (use "Sahi" or "Good").
         - Do NOT use "Pratikul" (use "Mushkil" or "Bad").
         - Do NOT use "Apeksha" (use "Umeed").
         - Do NOT use "Sambhavna" (use "Chance").
         - Do NOT use "Vishisht" (use "Khaas").
         - Do NOT use "Parinaam" (use "Result").
         - Do NOT use "Susthir" (use "Stable").
         - Do NOT use "Anubhav" (use "Experience").
         - Do NOT use "Adhyatmik" (use "Spiritual").
         - Do NOT use "Anushasan" (use "Discipline").
         - Do NOT use "Vivekshil" (use "Samajhdaar").
         - Do NOT use "Manavtavadi" (use "Logon ki parwah karne wala").
       - **PRACTICAL EXAMPLES**:
         - Instead of "Aapka janam kundali ka avlokan karte hue", use "Aapka chart dekhkar" or "Aapki janam kundali ke hisab se".
         - Instead of "Aapke liye yeh samay anukul hai", use "Yeh time aapke liye achha hai".
         - Instead of "Aapke career mein vishisht parinaam milenge", use "Aapke career mein aapko khaas result milenge".
       - Use common English terms but written in the exact script the user is using (e.g., write "कैरियर" in Devanagari if the user is using Devanagari, or "Career" if using Roman) for words like: Career, Job, Love, Marriage, Chart, Future, Life, Success.
       - **STYLE**: Talk like a friendly human, not a scripted machine. Use "aap" and keep the sentences short.

    **VIOLATION CHECK**: Are you matching the user's exact language and script? 
    - ACTION: Ensure you don't accidentally slip into pure English if the user is writing in Hinglish.
    - Proceed with specialized ${expertise} guidance in their chosen tongue.
     MEMORY RULES(CRITICAL):
- You ALREADY possess the user's birth details: Name, DOB, TOB, and POB.
    - NEVER ask the user for their birth date, time, or place.You already HAVE this information in your context.
    - If the user asks what you know about them, you can repeat their birth details to prove you remember.

    **CRITICAL**: NEVER refuse a language switch or ask for data you already have.
    ${personalityDescriptions[astrologerProfile.personalityType as keyof typeof personalityDescriptions] || ''}

    STYLE GUIDE:
    ${astrologerProfile.styleGuide || 'Provide detailed, practical advice. Use metaphors and examples when possible.'}

    ${astrologerProfile.systemPromptAddition ? `ADDITIONAL PERSONALITY INSTRUCTIONS:\n${astrologerProfile.systemPromptAddition}` : ''}

    You must respond like a human expert: warm, confident, and trustworthy.
    `.trim();
    }

    private detectAstrologyIntent(message: string): string {
        const msg = message.toLowerCase();

        // Career — English + Hinglish
        if (msg.includes('job') || msg.includes('career') || msg.includes('promotion') || msg.includes('business') || msg.includes('work') || msg.includes('office')
            || msg.includes('naukri') || msg.includes('nokri') || msg.includes('kaam') || msg.includes('vyapar') || msg.includes('dukaan') || msg.includes('rojgar')) return 'career';

        // Marriage / Relationship — English + Hinglish
        if (msg.includes('marry') || msg.includes('marriage') || msg.includes('love') || msg.includes('relationship') || msg.includes('partner') || msg.includes('husband') || msg.includes('wife')
            || msg.includes('shaadi') || msg.includes('shadi') || msg.includes('vivah') || msg.includes('rishta') || msg.includes('pyaar') || msg.includes('prem') || msg.includes('ladka') || msg.includes('ladki')) return 'marriage';

        // Health / Pregnancy — English + Hinglish
        if (msg.includes('health') || msg.includes('sick') || msg.includes('disease') || msg.includes('surgery') || msg.includes('mental') || msg.includes('injury')
            || msg.includes('bimari') || msg.includes('beemari') || msg.includes('dard') || msg.includes('operation') || msg.includes('dawai') || msg.includes('hospital')
            || msg.includes('pregnant') || msg.includes('pargnet') || msg.includes('conceive') || msg.includes('consiv') || msg.includes('baby') || msg.includes('bacha') || msg.includes('child')) return 'health';

        // Finance — English + Hinglish
        if (msg.includes('money') || msg.includes('finance') || msg.includes('wealth') || msg.includes('rich') || msg.includes('investment') || msg.includes('loan')
            || msg.includes('paisa') || msg.includes('paise') || msg.includes('dhan') || msg.includes('ameer') || msg.includes('garib') || msg.includes('udhaar') || msg.includes('karj')) return 'finance';

        // Education — English + Hinglish
        if (msg.includes('math') || msg.includes('science') || msg.includes('study') || msg.includes('learn') || msg.includes('exam') || msg.includes('education') || msg.includes('college') || msg.includes('school') || msg.includes('intelligence') || msg.includes('mind') || msg.includes('brain')
            || msg.includes('padhai') || msg.includes('padhna') || msg.includes('result') || msg.includes('pass') || msg.includes('fail') || msg.includes('imtihan')) return 'education';

        // Travel / Foreign Settlement — English + Hinglish
        if (msg.includes('travel') || msg.includes('foreign') || msg.includes('abroad') || msg.includes('visa') || msg.includes('country') || msg.includes('pr') || msg.includes('settle')
            || msg.includes('videsh') || msg.includes('bidesh') || msg.includes('yatra') || msg.includes('bahar') || msg.includes('ticket') || msg.includes('flight')) return 'travel';

        // Legal / Court Cases — English + Hinglish
        if (msg.includes('court') || msg.includes('case') || msg.includes('legal') || msg.includes('lawyer') || msg.includes('police') || msg.includes('jail') || msg.includes('prison')
            || msg.includes('kacheri') || msg.includes('mukadma') || msg.includes('vakil') || msg.includes('faisla') || msg.includes('peshi') || msg.includes('vivad') || msg.includes('ladai')) return 'legal';

        // Property / Vehicles — English + Hinglish
        if (msg.includes('property') || msg.includes('house') || msg.includes('home') || msg.includes('land') || msg.includes('car') || msg.includes('vehicle') || msg.includes('buy')
            || msg.includes('makaan') || msg.includes('makan') || msg.includes('ghar') || msg.includes('zameen') || msg.includes('jamin') || msg.includes('gaadi') || msg.includes('gadi') || msg.includes('plot')) return 'property';

        // Children / Progeny — English + Hinglish (Health also covers pregnancy, but this focuses strictly on children/family planning)
        if (msg.includes('child') || msg.includes('kid') || msg.includes('son') || msg.includes('daughter') || msg.includes('progeny') || msg.includes('family planning')
            || msg.includes('bacha') || msg.includes('bachha') || msg.includes('ladka') || msg.includes('ladki') || msg.includes('santan') || msg.includes('santaan') || msg.includes('aulad')) return 'children';

        // Daily / Horoscope
        if (msg.includes('today') || msg.includes('daily') || msg.includes('horoscope') || msg.includes('aaj') || msg.includes('tomorrow')) return 'daily';

        // Casual greeting or short emoji/acknowledgments
        const textOnly = msg.replace(/[\W_]+/g, '').trim();
        if (
            textOnly.length === 0 || // Just emojis or punctuation (e.g. 🙏)
            (msg.match(/(hi|hello|hey|greetings|namaste|pranam|how are you|kya haal|wassup|good morning|good evening|thanks|thank you|🙏|👍|👋|😊)/i) && msg.split(' ').length < 10)
        ) {
            return 'casual';
        }

        return 'general';
    }

    private buildAstroContext(astroData: any, intent: string = 'general', expertise: string = 'Vedic'): string {
        const now = new Date();
        const currentDateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

        if (!astroData || !astroData.kundli || astroData.status === 'error') {
            return `CURRENT SERVER DATE: ${currentDateStr}
            
SUBJECT IDENTITY & BIRTH DETAILS:
- Name: ${astroData.name || 'Seeker'}
- DOB: ${astroData.dob || astroData.dateOfBirth || 'Unknown'}
- TOB: ${astroData.tob || astroData.timeOfBirth || 'Unknown'}
- POB: ${astroData.pob || astroData.placeOfBirth || 'Unknown'}

INSTRUCTION: 
Provide a deeply intuitive and spiritual reading based closely on the seeker's birth details provided above. Focus on the energetic significance of their birth date and your astrological expertise. Do not mention any missing charts, missing coordinates, or technical issues to the user. Speak with divine authority and guide them gracefully.`;
        }

        const kundli = astroData.kundli;
        const dasha = astroData.dasha;
        const doshas = astroData.doshas;

        // ⚠️ IMPORTANT: The Vedic prompt's CHART DATA LOCK rule explicitly references "ASTRO_DATA".
        // This label MUST stay "ASTRO_DATA" for Vedic — if you rename it, GPT will ignore the lock.
        const dataLabel = expertise === 'Vedic' ? 'ASTRO_DATA' : 'ASTROLOGICAL REFERENCE DATA';
        let context = `CURRENT SERVER DATE: ${currentDateStr}\n`;

        context += `\nSUBJECT IDENTITY & BIRTH DETAILS:\n`;
        context += `- Name: ${astroData.name || 'Seeker'}\n`;
        context += `- DOB: ${astroData.dob || astroData.dateOfBirth || 'Unknown'}\n`;
        context += `- TOB: ${astroData.tob || astroData.timeOfBirth || 'Unknown'}\n`;
        context += `- POB: ${astroData.pob || astroData.placeOfBirth || 'Unknown'}\n`;

        if (astroData.query) {
            context += `\nADDITIONAL CONSULTATION DETAILS PROVIDED BY USER:\n`;
            context += `${astroData.query}\n`;
        }

        context += `\n${dataLabel} (FACTUAL — LOCKED. USE EXACTLY AS-IS. DO NOT INFER OR SUBSTITUTE.):\n`;

        if (expertise === 'Vedic') {
            context += `Lagna: ${kundli.houses?.[1]?.sign || 'Unknown'}\n`;
            context += `Moon Sign: ${kundli.planets?.Moon?.sign || 'Unknown'}\n`;

            const relevantPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

            context += `\nRelevant Planetary Positions (Placement & Lordship):\n`;
            relevantPlanets.forEach(p => {
                if (kundli.planets[p]) {
                    const data = kundli.planets[p];
                    const lords = data.lords && data.lords.length > 0 ? `Lords: ${data.lords.join(', ')}` : '';
                    context += `${p}: ${data.sign} in ${data.house || 'Unknown'} house (${data.degree?.toFixed(2)}°). ${lords}\n`;
                }
            });

            context += `\nDetailed House Analysis (Bhava & Lords):\n`;
            [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach(h => {
                if (kundli.houses?.[h]) {
                    const house = kundli.houses[h];
                    context += `House ${h} (${house.sign}): Lord is ${house.lord}. `;
                    const planetsInHouse = Object.entries(kundli.planets)
                        .filter(([_, pData]: [string, any]) => pData.house === h)
                        .map(([pName, _]) => pName);

                    if (planetsInHouse.length > 0) {
                        context += `Planets here: ${planetsInHouse.join(', ')}`;
                    } else {
                        context += `No planets here.`;
                    }
                    context += `\n`;
                }
            });

            // Bug #3 Fix: Align Dasha structure with Python bridge output
            const currentDasha = dasha?.current;
            if (currentDasha) {
                const antardasha = currentDasha.antardashas?.find((a: any) => a.is_current) || currentDasha.antardashas?.[0];
                context += `\nCurrent Dasha Period:\n`;
                context += `Mahadasha: ${currentDasha.lord} (Ends: ${currentDasha.end})\n`;
                if (antardasha) {
                    context += `Antardasha: ${antardasha.lord} (Ends: ${antardasha.end})\n`;
                }
            }

            if (astroData.panchang) {
                const p = astroData.panchang;
                context += `\nPanchang Attributes:\n`;
                context += `- Tithi: ${p.tithi}\n`;
                context += `- Nakshatra: ${p.nakshatra}\n`;
                context += `- Yoga: ${p.yoga}\n`;
                context += `- Karana: ${p.karana}\n`;
            }

            if (kundli.aspects && kundli.aspects.length > 0) {
                context += `\nSignificant Planetary Aspects:\n`;
                kundli.aspects.forEach((a: string) => context += `- ${a}\n`);
            }

            if (astroData.transits && astroData.transits.length > 0) {
                context += `\nTODAY'S PLANETARY TRANSITS (GOCHAR):\n`;
                astroData.transits.forEach((p: any) => {
                    if (p.name !== 'Ascendant') {
                        context += `- Transit ${p.name} is in ${p.sign} (${p.degree?.toFixed(2)}°)\n`;
                    }
                });
            }

            if (doshas) {
                context += `\nDETECTED DOSHAS:\n`;
                if (doshas.manglik?.is_present) context += `- Manglik: ${doshas.manglik.details}\n`;
                if (doshas.kalsarp?.is_present) context += `- Kalsarp: ${doshas.kalsarp.details}\n`;
            }

            // ✅ Added Yoga Detection for Vedic Context
            const yogas = this.calculateCommonYogas(kundli);
            if (yogas.length > 0) {
                context += `\nDETECTED AUSPICIOUS YOGAS:\n`;
                yogas.forEach(y => context += `- ${y.name}: ${y.description}\n`);
            }
        } else if (expertise === 'Numerology') {
            const dob = astroData.dob || astroData.dateOfBirth || '';
            const name = astroData.name || '';

            const lifePath = this.calculateLifePath(dob);
            const moolank = this.calculateMoolank(dob);
            const destinyNumber = this.calculateDestinyNumber(name);
            const soulUrgeNumber = this.calculateSoulUrgeNumber(name);
            const personalityNumber = this.calculatePersonalityNumber(name);
            const loveAttitudeNumber = this.calculateLoveAttitudeNumber(dob);
            const currentYear = new Date().getFullYear();
            const personalYear = this.calculatePersonalYear(dob, currentYear);

            context += `Subject's Core Numerology Data:\n`;
            context += `- Life Path Number (Bhagyank): ${lifePath}\n`;
            context += `- Radical/Birth Number (Moolank): ${moolank}\n`;
            context += `- Destiny/Expression Number (Namank): ${destinyNumber}\n`;
            context += `- Soul Urge/Heart's Desire Number: ${soulUrgeNumber}\n`;
            context += `- Personality Number: ${personalityNumber}\n`;
            context += `- Love/Attitude Number: ${loveAttitudeNumber}\n`;
            context += `- Current Personal Year (${currentYear}): ${personalYear}\n`;
            context += `Note: Focus strictly on Numerology interpretation (Pythagorean or Chaldean). Provide guidance based on Life Path, Destiny, Personal Year, and other core vibrations. The LLM MUST NOT attempt to recalculate these numbers, they are already accurate.\n`;
        } else {
            context += `Subject's Sun Sign: ${kundli.planets?.Sun?.sign || 'Unknown'}\n`;
            context += `Subject's Moon Sign: ${kundli.planets?.Moon?.sign || 'Unknown'}\n`;

            if (expertise !== 'Tarot') {
                const yogas = this.calculateCommonYogas(kundli);
                if (yogas.length > 0) {
                    context += `\nDETECTED AUSPICIOUS YOGAS:\n`;
                    yogas.forEach(y => context += `- ${y.name}: ${y.description}\n`);
                }
            }

            context += `Note: Focus strictly on ${expertise} interpretation. Do NOT use Vedic terminology, Dasha systems, or Yogas. Keep the Sun/Moon sign info strictly as a silent reference to understand the seeker's elements (fire/earth/air/water) for card layouts, and never explicitly tell the user "your Sun Sign is X" or talk about astrology transits.\n`;
        }

        return context.trim();
    }

    private calculateCommonYogas(kundli: any): { name: string, description: string }[] {
        const yogas: { name: string, description: string }[] = [];
        if (!kundli || !kundli.planets) return yogas;

        const p = kundli.planets;
        const houses = kundli.houses;

        // 1. Gaja Kesari Yoga (Jupiter in Kendra from Moon)
        if (p.Moon && p.Jupiter) {
            const moonHouse = p.Moon.house;
            const jupHouse = p.Jupiter.house;
            const dist = (jupHouse - moonHouse + 12) % 12 + 1;
            if ([1, 4, 7, 10].includes(dist)) {
                yogas.push({
                    name: "Gaja Kesari Yoga",
                    description: "Jupiter is in a Kendra from the Moon. Brings wisdom, wealth, and lasting reputation."
                });
            }
        }

        // 2. Pancha Mahapurusha Yogas
        const checkMahapurusha = (planetName: string, yogaName: string, desc: string) => {
            const planet = p[planetName];
            if (planet && [1, 4, 7, 10].includes(planet.house)) {
                if (planet.relation === "Own Sign" || planet.relation === "Exalted") {
                    yogas.push({ name: yogaName, description: desc });
                }
            }
        };

        checkMahapurusha("Mars", "Ruchaka Yoga", "Mars is strong in a Kendra. Brings courage, leadership, and victory.");
        checkMahapurusha("Mercury", "Bhadra Yoga", "Mercury is strong in a Kendra. Brings sharp intellect, business acumen, and eloquence.");
        checkMahapurusha("Jupiter", "Hamsa Yoga", "Jupiter is strong in a Kendra. Brings divine wisdom, high character, and spiritual growth.");
        checkMahapurusha("Venus", "Malavya Yoga", "Venus is strong in a Kendra. Brings luxury, artistic talent, and happy relationships.");
        checkMahapurusha("Saturn", "Shasha Yoga", "Saturn is strong in a Kendra. Brings authority, discipline, and long-term success.");

        // 3. Budha-Aditya Yoga (Sun and Mercury together)
        if (p.Sun && p.Mercury && p.Sun.sign === p.Mercury.sign) {
            yogas.push({
                name: "Budha-Aditya Yoga",
                description: "Sun and Mercury are in the same sign. Enhances intelligence, professional success, and status."
            });
        }

        // 4. Lakshmi Yoga (Classical definition)
        // Lagna Lord must be strong (Own Sign, Exalted, or in Kendra/Trikona)
        // AND 9th Lord must be strong (Own Sign, Exalted) and in Kendra/Trikona
        const lagnaSign = kundli.ascendant;
        const lagnaLord = this.getLordOfSign(lagnaSign);
        const ninthHouse = houses[9];
        const ninthLord = ninthHouse?.lord;

        if (p[ninthLord] && p[lagnaLord]) {
            const lagnaStrong = ["Exalted", "Own Sign", "Moolatrikona"].includes(p[lagnaLord].relation) || [1, 4, 7, 10, 5, 9].includes(p[lagnaLord].house);
            const ninthStrong = ["Exalted", "Own Sign"].includes(p[ninthLord].relation) && [1, 4, 7, 10, 5, 9].includes(p[ninthLord].house);

            if (lagnaStrong && ninthStrong) {
                yogas.push({
                    name: "Lakshmi Yoga",
                    description: "Classical alignment of 9th and Lagna lords. Indicates significant wealth, good fortune, and prosperity."
                });
            }
        }

        return yogas;
    }

    private getLordOfSign(sign: string): string {
        const lords: Record<string, string> = {
            "Aries": "Mars", "Taurus": "Venus", "Gemini": "Mercury", "Cancer": "Moon",
            "Leo": "Sun", "Virgo": "Mercury", "Libra": "Venus", "Scorpio": "Mars",
            "Sagittarius": "Jupiter", "Capricorn": "Saturn", "Aquarius": "Saturn", "Pisces": "Jupiter"
        };
        return lords[sign] || "Unknown";
    }

    // ✅ Kept from Doc2 — Life Path calculator helper
    private calculateLifePath(dob: string): number {
        if (!dob) return 0;
        // Format: YYYY-MM-DD
        const digits = dob.replace(/[^0-9]/g, '');
        let sum = digits.split('').reduce((acc, digit) => acc + parseInt(digit, 10), 0);

        // Reduction logic (keeping Master Numbers 11, 22, 33)
        const reduce = (n: number): number => {
            if (n <= 9 || n === 11 || n === 22 || n === 33) return n;
            const s = n.toString().split('').reduce((acc, d) => acc + parseInt(d, 10), 0);
            return reduce(s);
        };

        return reduce(sum);
    }

    private reduceNumerology(n: number, keepMaster: boolean = false): number {
        if (n <= 9 || (keepMaster && (n === 11 || n === 22 || n === 33))) return n;
        const s = n.toString().split('').reduce((acc, d) => acc + parseInt(d, 10), 0);
        return this.reduceNumerology(s, keepMaster);
    }

    private getChaldeanValue(char: string): number {
        const c = char.toUpperCase();
        if (['A', 'I', 'J', 'Q', 'Y'].includes(c)) return 1;
        if (['B', 'K', 'R'].includes(c)) return 2;
        if (['C', 'G', 'L', 'S'].includes(c)) return 3;
        if (['D', 'M', 'T'].includes(c)) return 4;
        if (['E', 'H', 'N', 'X'].includes(c)) return 5;
        if (['U', 'V', 'W'].includes(c)) return 6;
        if (['O', 'Z'].includes(c)) return 7;
        if (['F', 'P'].includes(c)) return 8;
        return 0;
    }

    private calculateMoolank(dob: string): number {
        if (!dob) return 0;
        const parts = dob.split(/[-/]/);
        let dayPart = parts[0];
        if (parts.length >= 3) {
            if (parts[0].length === 4) dayPart = parts[2]; // YYYY-MM-DD
            else dayPart = parts[0]; // DD-MM-YYYY
        }
        const daySum = dayPart.replace(/[^0-9]/g, '').split('').reduce((a, b) => a + parseInt(b, 10), 0);
        return this.reduceNumerology(daySum, false);
    }

    private calculateDestinyNumber(name: string): number {
        if (!name) return 0;
        let sum = 0;
        for (const char of name) sum += this.getChaldeanValue(char);
        return this.reduceNumerology(sum, true);
    }

    private calculateSoulUrgeNumber(name: string): number {
        if (!name) return 0;
        const vowels = ['A', 'E', 'I', 'O', 'U'];
        let sum = 0;
        for (const char of name) {
            if (vowels.includes(char.toUpperCase())) sum += this.getChaldeanValue(char);
        }
        return this.reduceNumerology(sum, true);
    }

    private calculatePersonalityNumber(name: string): number {
        if (!name) return 0;
        const vowels = ['A', 'E', 'I', 'O', 'U'];
        let sum = 0;
        for (const char of name) {
            if (char.match(/[a-zA-Z]/) && !vowels.includes(char.toUpperCase())) {
                sum += this.getChaldeanValue(char);
            }
        }
        return this.reduceNumerology(sum, true);
    }

    private calculateLoveAttitudeNumber(dob: string): number {
        if (!dob) return 0;
        const parts = dob.split(/[-/]/);
        let day = '', month = '';
        if (parts.length >= 3) {
            if (parts[0].length === 4) { month = parts[1]; day = parts[2]; }
            else { day = parts[0]; month = parts[1]; }
        }
        const str = (day + month).replace(/[^0-9]/g, '');
        const sum = str.split('').reduce((a, b) => a + parseInt(b, 10), 0);
        return this.reduceNumerology(sum, false);
    }

    private calculatePersonalYear(dob: string, currentYear: number): number {
        if (!dob) return 0;
        const parts = dob.split(/[-/]/);
        let day = '', month = '';
        if (parts.length >= 3) {
            if (parts[0].length === 4) { month = parts[1]; day = parts[2]; }
            else { day = parts[0]; month = parts[1]; }
        }
        const str = (day + month + currentYear.toString()).replace(/[^0-9]/g, '');
        const sum = str.split('').reduce((a, b) => a + parseInt(b, 10), 0);
        return this.reduceNumerology(sum, false);
    }

    private getOpenAIMessages(systemPrompt: string, astroContext: string, conversationHistory: any[]) {
        const messages: any[] = [{ role: 'system', content: systemPrompt }];

        if (astroContext && astroContext.length > 5) {
            messages.push({
                role: 'user',
                content: `ASTROLOGICAL CONTEXT FOR THIS SESSION:\n${astroContext}`
            });
            messages.push({
                role: 'assistant',
                content: "I have received the divine birth data. I am ready to guide based on these cosmic patterns."
            });
        }

        conversationHistory.slice(-8).forEach(msg => {
            let cleanContent = msg.content || '';
            // Remove the [USER CONTEXT] block sent by older mobile apps so it doesn't confuse the AI
            cleanContent = cleanContent.replace(/\[USER CONTEXT\][\s\S]*?\[\/USER CONTEXT\]/gi, '').trim();
            if (!cleanContent) cleanContent = 'Hello';
            
            messages.push({
                role: msg.senderModel === 'User' ? 'user' : 'assistant',
                content: cleanContent
            });
        });

        return messages;
    }

    async generateResponse(
        userMessage: string,
        astrologerProfile: {
            name: string;
            gender?: string;
            tone?: string;
            styleGuide?: string;
            personalityType?: string;
            systemPromptAddition?: string;
            expertise?: string;
            bio?: string;
            focusArea?: string;
            // Bug 4 Fix: Accept per-astrologer model params
            aiModelParams?: { temperature?: number; topP?: number; maxOutputTokens?: number };
        },
        userBirthDetails: {
            dateOfBirth: string;
            timeOfBirth: string;
            placeOfBirth: string;
            name: string;
        },
        conversationHistory: any[] = [],
        language: string = 'English'
    ): Promise<string> {
        let rawExpertise = astrologerProfile.expertise || 'Vedic';
        // Normalize casing to handle both 'Lalkitab' and 'LalKitab'
        let expertise = rawExpertise.toLowerCase() === 'lalkitab' ? 'LalKitab' : (rawExpertise.charAt(0).toUpperCase() + rawExpertise.slice(1).toLowerCase());

        // ✅ Updated from Doc1 — LalKitab added to allowed expertise list
        if (!['Vedic', 'Tarot', 'Numerology', 'LalKitab'].includes(expertise)) {
            expertise = 'Vedic';
        }

        try {
            this.logger.log('🤖 [AI Engine] Generating response...');

            const intent = this.detectAstrologyIntent(userMessage);

            // Fix 2 — Repetition Detection: Count how many times user asked about same intent
            const repeatCount = this.countRepeatedIntent(intent, conversationHistory);

            const currentYear = new Date().getFullYear();
            const personaPrompt = this.buildPersonaPrompt({ ...astrologerProfile, expertise }, language, currentYear);
            const specializationPrompt = (this.SPECIALIZATION_PROMPTS[expertise as keyof typeof this.SPECIALIZATION_PROMPTS] || this.SPECIALIZATION_PROMPTS.Vedic)[intent as keyof (typeof this.SPECIALIZATION_PROMPTS)['Vedic']] || (this.SPECIALIZATION_PROMPTS[expertise as keyof typeof this.SPECIALIZATION_PROMPTS] || this.SPECIALIZATION_PROMPTS.Vedic).general;

            // Define "IMPORTANT" instruction block
            let instructions = '';

            // Fix 2 — Inject anti-repetition rule when user repeats same question 2+ times
            if (repeatCount >= 2 && intent !== 'casual' && intent !== 'daily') {
                instructions += `\nCRITICAL OVERRIDE — ANTI-REPETITION:
- The user has asked about this SAME topic ${repeatCount} time(s) already.
- You have already given your standard answer. You MUST NOT repeat the same advice, phrases, or conclusions.
- Give a COMPLETELY different astrological angle: focus on a DIFFERENT house, planet, or Dasha period than what you mentioned before.
- If there is genuinely nothing new to add from the chart, say ONCE: "I've shared the key chart indications for this. For deeper clarity, a detailed chart study would be ideal."
- Under NO circumstances repeat phrases like "patience rakhein", "kuch samay baad", "aap apne upar focus karein" if you have already said them.\n`;
            }

            if (intent === 'casual') {
                // Bug 10 Fix: Language-aware casual greeting instead of hardcoded Hindi
                const isHindi = language?.toLowerCase().includes('hi');
                const casualGreeting = isHindi
                    ? `"Namaste ${userBirthDetails.name}, aapka swagat hai. Maine aapki details dekh li hain, batayein main aaj aapki kya madad kar sakta hoon?"`
                    : `"Welcome ${userBirthDetails.name}! I have your details with me. How may I guide you today?"`;
                instructions = `
    IMPORTANT:
    - You MUST reply EXACTLY with the following greeting phrase:
      ${casualGreeting}
    - DO NOT provide any readings, predictions, numbers, tarot cards, or planetary information yet.
    - DO NOT add any extra text before or after this phrase.
    `;
            } else if (intent === 'daily') {
                instructions = `
    IMPORTANT:
    - **NAME**: You may optionally use the seeker's name (${userBirthDetails.name}), but do not use it in every response.
    - **NARRATIVE STYLE**: Weave today's transits into 2 short, flowing paragraphs. 
    - **STRICT RULE**: NO headers (###), NO bullets (*), NO bold (**). Use ONLY plain text.
    - **CONTENT**: Describe the core cosmic energy of the day and give 1-2 practical actions. Keep it atmospheric but very concise.
    - **LENGTH**: 80-120 words.
    `;
            } else {
                // Select structure based on expertise
                if (expertise === 'Tarot') {
                    instructions = `
    IMPORTANT:
    - **NAME**: You may optionally use the seeker's name (${userBirthDetails.name}), but do not use it in every response.
    - **STRICT LANGUAGE RULE**: You MUST reply in the exact language of the user's current message. If the user writes in Hindi/Hinglish, you MUST reply in Hindi/Hinglish. DO NOT switch to English.
    - **EMPATHETIC TONE**: If the user shares any personal struggle, acknowledge it briefly in just ONE short sentence. Be warm but professional, not overly dramatic.
    - **INTEGRATED NARRATIVE**: Provide a smooth, card-based reading in 2 short paragraphs.
    - **STRICT RULE**: NO headers (###), NO bullets (*), NO bold (**). Use ONLY plain text.
    - **CONSISTENCY RULE (CRITICAL)**: Check the conversation history. If you previously drew a specific Tarot card for this exact topic/question, you MUST stick to that EXACT same card and deepen its meaning. Do NOT draw a new card for the same question.
    - **VARIATION RULE**: Do NOT start your sentences the same way as previous messages (e.g., avoid repeating "Your cards suggest..."). Vary your phrasing completely so you don't sound like a script.
    - **CONTENT**: Focus 100% on Tarot card imagery, spreads, and arcana symbolism. Do NOT explicitly mention the user's "Sun Sign", "Moon Sign", "planets", or "Vedic horoscope". If a card has an astrological connection (like The Emperor being linked to Mars/Aries), you may mention the "bold, pioneering Aries-like energy of the card" to enrich the story, but DO NOT say "you have an Aries Sun Sign". Keep the entire reading strictly card-based.
    - **LENGTH**: 80-120 words.
    `;
                } else if (expertise === 'Numerology') {
                    instructions = `
    IMPORTANT:
    - **NAME**: You may optionally use the seeker's name (${userBirthDetails.name}), but do not use it in every response.
    - **STRICT LANGUAGE RULE**: You MUST reply in the exact language of the user's current message. If the user writes in Hindi/Hinglish, you MUST reply in Hindi/Hinglish. DO NOT switch to English.
    - **EMPATHETIC TONE**: If the user shares any personal struggle, acknowledge it briefly in just ONE short sentence. Be warm but professional, not overly dramatic.
    - **SMOOTH CYCLES**: Provide a numerical analysis in 2 concise paragraphs.
    - **STRICT RULE**: NO headers (###), NO bullets (*), NO bold (**). Use ONLY plain text. NEVER end your message by asking questions like "Would you like to know about your X number?".
    - **CONSISTENCY RULE (CRITICAL)**: Check the conversation history. If you previously calculated a specific Life Path or Destiny number, you MUST consistently use those exact same numbers. Do NOT change them.
    - **VARIATION RULE**: Do NOT start your sentences the same way as previous messages. Vary your phrasing completely so you don't sound like a script.
    - **CONTENT**: Provide guidance based on Life Path, Destiny, and Personal Year numbers. Link these numbers directly to the user's current real-world situation, whatever it may be. Do NOT mention "Sun Signs", "Moon Signs", "planetary transits", "Kundali", or "Houses".
    - **LENGTH**: 80-120 words.
    `;
                } else {
                    // Default Vedic template
                    instructions = `
    IMPORTANT:
    - You may occasionally use the seeker's name (${userBirthDetails.name}), but do not force it into every response.
    - **STRICT LANGUAGE RULE**: You MUST reply in the exact language of the user's current message. If the user writes in Hindi/Hinglish, you MUST reply in Hindi/Hinglish. DO NOT switch to English.
    - **EMPATHETIC TONE**: If the user shares any personal struggle, acknowledge it briefly in just ONE short sentence. Be warm but professional, not overly dramatic.
    - **DIRECT ANSWER**: Answer the specific question in the first 1-2 sentences using chart data (Dasha, Lords).
    - **NO SYMBOLS**: Strictly NO headers (###), NO bullets (*), NO bold (**). Use ONLY plain text. NEVER ask robotic follow-up questions at the end.
    - **CONSISTENCY RULE (CRITICAL)**: Check the conversation history. If you previously analyzed a specific House or Planet for this topic, build upon that analysis instead of randomly jumping to a different one for the same question.
    - **VARIATION RULE**: Do NOT start your sentences the same way as previous messages. Vary your phrasing completely so you don't sound like a script.
    - **CONVERSATIONAL LOGIC**: Explain the astrological "why" in one integrated paragraph. Avoid repetitive "In your chart" or "As per Vedic astrology" phrases.
    - **TIMING**: Give specific years or phases but keep it conversational (e.g., "Between 2025 and 2027...").
    - **LENGTH**: 80-120 words.
    `;
                }
            }

            // Move instructions into System Prompt to give them high priority
            const systemPrompt = `${this.MASTER_SYSTEM_PROMPT}\n\n${personaPrompt}\n\n${specializationPrompt}\n\n${instructions}`;

            // ─────────────────────────────────────────────────────────────────────
            // FIX: Resolve actual coordinates for the user's birth place.
            // The previous hardcoded Delhi coords (28.7041 / 77.1025) overrode
            // everyone's birth location and was the #1 cause of wrong Ascendants.
            // ─────────────────────────────────────────────────────────────────────
            let lat: string | null = null;
            let lon: string | null = null;

            try {
                if (userBirthDetails.placeOfBirth) {
                    // Bug 5 Fix: Check geocode cache before hitting Nominatim API
                    const placeKey = userBirthDetails.placeOfBirth.toLowerCase().trim();
                    const cachedCoords = this.geocodeCache.get(placeKey);
                    if (cachedCoords && Date.now() - cachedCoords.timestamp < this.GEOCODE_CACHE_TTL) {
                        lat = cachedCoords.lat;
                        lon = cachedCoords.lon;
                        this.logger.debug(`📍 [AI Engine] Geocode cache HIT for "${userBirthDetails.placeOfBirth}"`);
                    } else {
                        const coords = await this.astronomyService.geocodePlaceOfBirth(userBirthDetails.placeOfBirth);
                        lat = String(coords.lat);
                        lon = String(coords.lon);
                        this.geocodeCache.set(placeKey, { lat, lon, timestamp: Date.now() });
                        this.logger.log(`📍 [AI Engine] Geocoded "${userBirthDetails.placeOfBirth}" → lat=${lat}, lon=${lon}`);
                    }
                }
            } catch (geoErr) {
                this.logger.warn(`⚠️ [AI Engine] geocodePlaceOfBirth() failed for "${userBirthDetails.placeOfBirth}". Precise coordinates unavailable.`);
            }

            let allAstroData = null;
            let transitsData = null;
            if (lat && lon) {
                try {
                    // Bug 6 Fix: Cache astro chart data — birth chart never changes, no need to re-compute every message
                    const astroKey = `${userBirthDetails.dateOfBirth}_${userBirthDetails.timeOfBirth}_${lat}_${lon}`;
                    const cachedAstro = this.astroDataCache.get(astroKey);
                    if (cachedAstro && Date.now() - cachedAstro.timestamp < this.ASTRO_CACHE_TTL) {
                        allAstroData = cachedAstro.data;
                        this.logger.debug(`🔮 [AI Engine] Astro data cache HIT for ${userBirthDetails.name}`);
                    } else {
                        allAstroData = await this.astronomyService.calculateAllData(
                            userBirthDetails.dateOfBirth,
                            userBirthDetails.timeOfBirth,
                            lat,
                            lon
                        );
                        // Cap cache at 500 entries (LRU-lite: evict oldest)
                        if (this.astroDataCache.size >= 500) {
                            const oldestKey = this.astroDataCache.keys().next().value;
                            if (oldestKey) this.astroDataCache.delete(oldestKey);
                        }
                        this.astroDataCache.set(astroKey, { data: allAstroData, timestamp: Date.now() });
                    }

                    if (intent === 'daily') {
                        transitsData = await this.astronomyService.getTransits(lat, lon);
                    }
                } catch (err) {
                    this.logger.error('❌ [AI Engine] Astronomy Service Failed:', err.message);
                }
            }

            const astroContext = this.buildAstroContext(
                {
                    ...(allAstroData || {}),
                    transits: transitsData,
                    name: userBirthDetails.name,
                    dob: userBirthDetails.dateOfBirth,
                    tob: userBirthDetails.timeOfBirth,
                    pob: userBirthDetails.placeOfBirth
                },
                intent,
                expertise
            );

            this.logger.log(`🚀 [AI Engine] Sending request to OpenAI with model ${this.MODEL_NAME}...`);
            this.logger.debug(`Context length: ${astroContext.length}, History length: ${conversationHistory.length}`);

            const openaiStartTime = Date.now();
            const tools = [
                {
                    type: "function",
                    function: {
                        name: "calculate_astrology_matching",
                        description: "Calculate full astrology data and match score for a secondary person provided by the user. ALWAYS normalize dates to YYYY-MM-DD and times to HH:MM (24-hour) before calling.",
                        parameters: {
                            type: "object",
                            properties: {
                                name: { type: "string", description: "Name of the second person" },
                                dateOfBirth: { type: "string", description: "Date of birth STRICTLY in YYYY-MM-DD format. Convert any DD/MM/YYYY or D/M/YYYY input before passing. Example: '10/6/1996' becomes '1996-06-10'." },
                                timeOfBirth: { type: "string", description: "Time of birth STRICTLY in HH:MM 24-hour format. Convert '12pm' to '12:00', '9am' to '09:00', '2:30 PM' to '14:30'." },
                                placeOfBirth: { type: "string", description: "City and State/Country of birth" }
                            },
                            required: ["name", "dateOfBirth", "timeOfBirth", "placeOfBirth"]
                        }
                    }
                }
            ];

            const cleanUserMessage = userMessage.replace(/\[USER CONTEXT\][\s\S]*?\[\/USER CONTEXT\]/gi, '').trim() || 'Hello';

            const initialMessages: any[] = [
                ...this.getOpenAIMessages(systemPrompt, astroContext, conversationHistory),
                { role: 'user', content: cleanUserMessage }
            ];

            // Bug 4 Fix: Use per-astrologer model params if provided, else fall back to defaults
            const modelParams = astrologerProfile.aiModelParams;
            let completion = await this.openai.chat.completions.create({
                model: this.MODEL_NAME,
                messages: initialMessages,
                max_tokens: modelParams?.maxOutputTokens ?? 800,
                temperature: modelParams?.temperature ?? 0.5,
                ...(modelParams?.topP !== undefined && { top_p: modelParams.topP }),
                tools: tools as any,
                tool_choice: "auto"
            });

            if (completion.choices[0].message.tool_calls) {
                this.logger.log(`🛠️ [AI Engine] Tool calls triggered: ${completion.choices[0].message.tool_calls.length}`);
                initialMessages.push(completion.choices[0].message);

                for (const toolCall of completion.choices[0].message.tool_calls) {
                    if (toolCall.type === 'function' && toolCall.function.name === 'calculate_astrology_matching') {
                        const args = JSON.parse(toolCall.function.arguments);

                        let toolResponseStr = JSON.stringify({
                            error: true,
                            message: "Chart calculation is temporarily unavailable. Provide guidance based on the birth details alone. Do NOT mention any technical issue, system error, or missing data to the user."
                        });
                        try {
                            // Fix 1 — Normalize date and time before passing to astronomy bridge
                            const normalizedDate = this.normalizeDateForTool(args.dateOfBirth);
                            const normalizedTime = this.normalizeTimeForTool(args.timeOfBirth);
                            this.logger.log(`🛠️ [Tool] Raw: date=${args.dateOfBirth}, time=${args.timeOfBirth} → Normalized: date=${normalizedDate}, time=${normalizedTime}`);

                            const coords = await this.astronomyService.geocodePlaceOfBirth(args.placeOfBirth);
                            // Derive timezone from longitude (standard formula: lon / 15, rounded to nearest 0.5)
                            const secondTzone = Math.round((coords.lon / 15) * 2) / 2;
                            const primaryTzone = lon ? Math.round((parseFloat(lon) / 15) * 2) / 2 : 5.5;
                            const bInput = {
                                date: userBirthDetails.dateOfBirth,
                                time: userBirthDetails.timeOfBirth || '12:00',
                                lat: lat ? parseFloat(lat) : 28.6139,
                                lon: lon ? parseFloat(lon) : 77.2090,
                                tzone: primaryTzone
                            };
                            const gInput = {
                                date: normalizedDate,
                                time: normalizedTime,
                                lat: coords.lat,
                                lon: coords.lon,
                                tzone: secondTzone
                            };

                            // Calculate Match
                            const matchResult = await this.astronomyService.matchHoroscope(bInput, gInput);

                            // Calculate their chart
                            const secondChart = await this.astronomyService.calculateAllData(
                                normalizedDate, normalizedTime, String(coords.lat), String(coords.lon), secondTzone
                            );

                            toolResponseStr = JSON.stringify({
                                matchScore: matchResult?.total_points || 0,
                                matchDetails: matchResult,
                                secondaryPersonChart: {
                                    ascendant: secondChart?.kundli?.ascendant,
                                    planets: secondChart?.kundli?.planets,
                                    dashas: secondChart?.dasha?.current
                                }
                            });
                            this.logger.log(`🛠️ [AI Engine] Tool data successfully retrieved for ${args.name}`);
                        } catch (e) {
                            this.logger.error(`🛠️ [AI Engine] Tool error for ${args.name}: ${e.message}`);
                            // toolResponseStr already has the graceful fallback — AI will not say "technical issue"
                        }

                        initialMessages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: toolResponseStr
                        });
                    }
                }
                this.logger.log(`🚀 [AI Engine] Re-prompting OpenAI with Tool Data...`);
                completion = await this.openai.chat.completions.create({
                    model: this.MODEL_NAME,
                    messages: initialMessages,
                    max_tokens: modelParams?.maxOutputTokens ?? 800,
                    temperature: modelParams?.temperature ?? 0.5,
                    ...(modelParams?.topP !== undefined && { top_p: modelParams.topP }),
                });
            }
            const openaiEndTime = Date.now();
            this.logger.log(`✅ [AI Engine] OpenAI responded in ${openaiEndTime - openaiStartTime}ms`);

            const content = completion.choices[0].message.content;

            if (!content) {
                if (expertise === 'Tarot') return 'I apologize, but the cards are unclear right now. Please try again.';
                if (expertise === 'Numerology') return 'I apologize, but the vibrations are misaligned. Please try again.';
                return 'I apologize, but the celestial connection was interrupted. Please try again.';
            }
            // Store link is appended WITH \n\n so the gateway paragraph-splitter
            // breaks it into a separate chat bubble. This keeps the user's reading clean.
            let storeLink = "\n\n✨ For trusted remedies and verified gemstones, visit our official store: https://vaidiktalk.store/";
            if (language?.toLowerCase() === 'hindi' || language?.toLowerCase() === 'hinglish') {
                storeLink = "\n\n✨ भरोसेमंद उपायों (Remedies) और असली रत्नों (Gemstones) के लिए हमारे ऑफिशियल स्टोर पर जाएं: https://vaidiktalk.store/";
            }

            return content + storeLink;

        } catch (error: any) {
            const errorMessage = error?.message || 'Unknown error';
            const errorStatus = error?.status || error?.response?.status || 'No status';
            const errorType = error?.type || error?.code || 'No type';

            this.logger.error(`❌ [AI Engine] Error generating AI response: ${errorMessage} (Status: ${errorStatus}, Type: ${errorType})`);

            if (errorStatus === 401) {
                this.logger.error('🔑 [AI Engine] Invalid OpenAI API Key. Please check your .env file.');
            } else if (errorStatus === 429) {
                this.logger.error('💳 [AI Engine] OpenAI Quota Exceeded or Rate Limited. Please check your billing/usage.');
            }

            if (expertise === 'Tarot') {
                return "I apologize, but I'm having trouble reading the cards right now. Please try again in a moment.";
            } else if (expertise === 'Numerology') {
                return "I apologize, but I'm having trouble aligning the vibrations right now. Please try again in a moment.";
            }

            return "I apologize, but I'm having trouble connecting to the stars right now. Please try again in a moment.";
        }
    }

    async generateSessionSummary(messages: any[]): Promise<string> {
        if (!messages?.length) return 'No conversation.';

        try {
            const text = messages
                .slice(-10)
                .map(m => `${m.senderModel}: ${m.content}`)
                .join('\n');

            const prompt = `Summarize this astrology consultation in 2-3 concise sentences:\n\n${text}`;

            const completion = await this.openai.chat.completions.create({
                model: this.MODEL_NAME,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 150,
                temperature: 0.5
            });

            return completion.choices[0].message.content || 'Summary unavailable.';
        } catch (error) {
            this.logger.error('Summary generation error:', error);
            return 'Summary unavailable.';
        }
    }

    async suggestFollowUps(
        conversationHistory: any[],
        astrologerProfile: any,
        birthChart: any,
        language: string = 'English'
    ): Promise<string[]> {
        try {
            const historyText = conversationHistory
                .slice(-5)
                .map(m => `${m.senderModel}: ${m.content}`)
                .join('\n');

            const personality = astrologerProfile?.personalityType || 'Modern';
            const expertise = astrologerProfile?.expertise || 'Vedic';
            const userName = birthChart?.name || 'User';

            const expertiseSpecificRules = {
                Vedic: 'Focus on Dashas, planetary transits, and remedies.',
                Tarot: 'Focus on card energies, future spreads, and emotional clarity.',
                Numerology: 'Focus on destiny numbers, cycles, and vibrational shifts.'
            };

            const prompt = `You are ${astrologerProfile?.name || 'an expert astrologer'}, a ${expertise} expert. 
        Based on this ${expertise} consultation with ${userName}, suggest 3 short, relevant questions that the USER should ask YOU next.
        
        STRICT RULES:
        1. Contextual Relevance: The questions MUST be directly related to the user's latest query and ${expertise}.
        2. Expertise Alignment: Suggestions must be specific to ${expertise} ONLY. 
           - Vedic: Ask about Dashas, Houses, Planets.
           - Tarot: Ask about card energies, spreads, intuition.
           - Numerology: Ask about Personal Years, Life Path vibrations, cycle shifts.
        3. NO TERM LEAKAGE: If ${expertise} is Numerology, do NOT suggest questions about "Kundali" or "7th House".
        4. Perspective: These MUST be from the USER's perspective (e.g., "What does my Life Path say about my career?" or "Which card reveals my true feelings?").
        5. Language: Output ONLY in ${language}.
        6. Personalization: Use the context of what was just discussed in the conversation.
        
        Recent conversation:
        ${historyText}
        
        Goal: Provide engaging, context-aware questions for the USER.
        Output ONLY a JSON array of strings: ["Question 1?", "Question 2?", "Question 3?"]`;

            const completion = await this.openai.chat.completions.create({
                model: this.MODEL_NAME,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200,
                temperature: 0.7
            });

            const responseText = completion.choices[0].message.content || '';
            const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(cleanedText);
        } catch (error) {
            this.logger.error('Follow-up suggestions error:', error);
            return [];
        }
    }

    async generateDynamicGreeting(
        userName: string = 'Seeker',
        language: string = 'English',
        astrologerProfile?: any
    ): Promise<string> {
        const astroName = astrologerProfile?.name || 'Divine Guide';
        const isFemale = astrologerProfile?.gender === 'female';
        const firstName = userName ? userName.split(' ')[0] : 'Seeker';

        // Return instant local string to save 1-2 seconds of OpenAI latency during call connection
        if (language?.toLowerCase().includes('hi')) {
            const suffix = isFemale ? 'सकती' : 'सकता';
            return `नमस्ते ${firstName}, मैं ${astroName} हूँ। मैं आज आपकी कैसे सहायता कर ${suffix} हूँ?`;
        } else {
            return `Namaste ${firstName}, I am ${astroName}. How may I guide you today?`;
        }
    }

    calculateQualityScore(aiResponse: string): number {
        // Look for self-evaluation metrics first [[METRICS: ACCURACY=X, EMPATHY=Y]]
        const metricsMatch = aiResponse.match(/\[\[METRICS: ACCURACY=(\d+), EMPATHY=(\d+)\]\]/i);
        if (metricsMatch) {
            const accuracy = parseInt(metricsMatch[1]);
            const empathy = parseInt(metricsMatch[2]);
            // Weigh them for a final quality score (mostly accuracy)
            return Math.min(Math.round((accuracy * 0.7) + (empathy * 0.3)), 10);
        }

        // ✅ Improved fallback heuristics with higher base score
        let score = 8; // Increased base score to 8/10

        // Length quality indicator (longer responses tend to be more detailed)
        if (aiResponse.length > 400) score += 1;
        else if (aiResponse.length > 200) score += 0.5;
        else if (aiResponse.length < 50) score -= 1; // Penalize very short responses

        // Structure bonus (numbered lists, bullet points indicate organized thinking)
        if (aiResponse.includes('1.') || aiResponse.includes('2.') || aiResponse.includes('•')) score += 0.5;

        // Core spiritual/astrological keywords (English & Hindi) - indicates domain expertise
        const hasAstroKeywords = /vibration|energy|karma|path|destiny|cycle|timing|guidance|remedy|blessing|Graha|Bhava|Dasha|Nakshatra|Yoga|planet|house|ascendant|रवि|चंद्र|मंगल|बुध|नक्षत्र|योग|दशा/i.test(aiResponse);
        if (hasAstroKeywords) {
            score += 1;
        }

        return Math.min(Math.max(score, 7), 10); // Clamp between 7-10
    }

    async getLalKitabData(dto: any): Promise<any> {
        this.logger.log(`🪐 [AI Engine] Synthesizing Lal Kitab wisdom for ${dto.name}...`);
        try {
            // 1. Fetch Admin Overrides & Config
            const settings = await this.lalKitabSettingsService.getOverrides();

            const birthData = await this.astronomyService.calculateAllData(
                dto.date,
                dto.time,
                dto.lat,
                dto.lon,
                dto.tzone || 5.5
            );

            // Bug 7 Fix: Was incorrectly passing 'Vedic' — LalKitab needs its own context label
            const astroContext = this.buildAstroContext(
                { ...birthData, name: dto.name, dob: dto.date, tob: dto.time, pob: dto.place },
                'general',
                'LalKitab'
            );

            // 2. Prepare Knowledge Libraries for AI selection
            const librariesContext = `
ADMIN KNOWLEDGE LIBRARIES (MANDATORY SELECTION BASE):
---
GENERAL_RULES_LIBRARY:
${settings.generalRules?.map((r: string, i: number) => `[ID: RULE_${i}] ${r}`).join('\n') || 'None'}

REMEDIES_BY_CATEGORY_LIBRARY:
${settings.lifeAreaRemedies?.map((r: any, i: number) => `[ID: REMEDY_${i}] [Category: ${r.category}] ${r.text}`).join('\n') || 'None'}

INSTRUCTIONS:
1. For the "generalRules" section, you MUST select the 5 most relevant items from the GENERAL_RULES_LIBRARY based on the native's chart. Use the text exactly.
2. For the "lifeAreaRemedies" section, you MUST select exactly one item from the REMEDIES_BY_CATEGORY_LIBRARY for each of the 5 categories (Health, Wealth, Career, Family, Protection). Pick the one that best fits the native's logic.
3. Only if a library is empty, you may generate your own traditional Lal Kitab remedies.
`.trim();

            // 3. Use Custom System Prompt if available
            const baseSystemPrompt = settings.systemPrompts?.general || this.SPECIALIZATION_PROMPTS.LalKitab.general;
            const systemPrompt = `${baseSystemPrompt}\n\n${librariesContext}`;
            const userPrompt = `Generate the personalized Lal Kitab report for this native:\n${astroContext}`;

            const response = await this.openai.chat.completions.create({
                model: this.MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7
            });

            const aiResult = JSON.parse(response.choices[0].message.content || '{}');

            // 4. APPLY HARD PLANET OVERRIDES (PLANET+HOUSE)
            if (aiResult.planets) {
                for (const [planetName, planetData] of Object.entries<any>(aiResult.planets)) {
                    const key = `${planetName}-${planetData.house}`;
                    if (settings.planetOverrides?.[key]) {
                        this.logger.log(`✅ [AI Engine] Applying Admin override for ${key}`);
                        aiResult.planets[planetName] = {
                            ...planetData,
                            ...settings.planetOverrides[key]
                        };
                    }
                }
            }

            return aiResult;
        } catch (error: any) {
            this.logger.error(`❌ [AI Engine] getLalKitabData failed for ${dto?.name}: ${error?.message}`);
            throw new Error(`Lal Kitab report generation failed: ${error?.message || 'Unknown error'}`);
        }
    }




    async getMoonSignReading(birthDetails: any): Promise<any> {
        try {
            this.logger.log(`🌙 [Moon Sign] Generating moon sign reading for ${birthDetails.name}...`);

            let lat = birthDetails.lat;
            let lon = birthDetails.lon;

            // Only geocode if coordinates are missing
            if (!lat || !lon) {
                this.logger.log(`📍 No coordinates provided for "${birthDetails.place}". Attempting fallback geocoding...`);
                const coords = await this.astronomyService.geocodePlaceOfBirth(birthDetails.place);
                lat = coords.lat;
                lon = coords.lon;
            }

            const astroData = await this.astronomyService.calculateAllData(
                birthDetails.date,
                birthDetails.time,
                String(lat),
                String(lon),
                birthDetails.tzone || 5.5
            );

            const moonSign = astroData?.panchang?.moon_sign || astroData?.kundli?.planets?.Moon?.sign || 'Unknown';
            const moonNakshatra = astroData?.panchang?.nakshatra || 'Unknown';
            const moonHouse = astroData?.kundli?.planets?.Moon?.house || 'Unknown';
            const moonDegree = astroData?.kundli?.planets?.Moon?.degree || 0;

            // 1. Fetch DB Profile (Admin Master Data)
            const dbProfile = await this.astrologyContentService.getMoonSignByName(moonSign);

            const systemPrompt = `You are a Master Vedic Astrologer specializing in Moon Sign (Rashi) analysis. You MUST respond with ONLY a raw JSON object. No markdown, no backticks, no preamble. Your entire response must be parseable by JSON.parse().

            ${dbProfile ? `
            MASTER DATA (PRIORITY): 
            The admin has defined the following master data for ${moonSign}. You MUST use these values for the respective keys in the output:
            - sanskritName: "${dbProfile.sanskritName}"
            - symbol: "${dbProfile.symbol}"
            - element: "${dbProfile.element}"
            - quality: "${dbProfile.quality}"
            - rulingPlanet: "${dbProfile.rulingPlanet}"
            - moonMantra: "${dbProfile.moonMantra}"
            - strengths: ${JSON.stringify(dbProfile.strengths)}
            - weaknesses: ${JSON.stringify(dbProfile.weaknesses)}
            - luckyAttributes: ${JSON.stringify(dbProfile.luckyAttributes)}
            - compatibility: ${JSON.stringify(dbProfile.compatibility)}
            
            When writing the 'overview', 'personalityTraits', and 'emotionalNature', use the following base content and expand/personalize it for the user:
            - Master Overview: "${dbProfile.overview}"
            - Master Emotional Nature: "${dbProfile.emotionalNature}"
            - Master Nakshatra Insight: "${dbProfile.nakshatraInsight}"
            ` : ''}

OUTPUT JSON STRUCTURE (STRICT):
{
  "moonSign": "${moonSign}",
  "sanskritName": "The Sanskrit/Hindi name of the rashi e.g. Vrishabha, Simha",
  "symbol": "The zodiac symbol character e.g. ♉, ♌",
  "element": "Fire/Earth/Air/Water",
  "quality": "Cardinal/Fixed/Mutable",
  "rulingPlanet": "The ruling planet of this sign",
  "rulingPlanetSanskrit": "Sanskrit name of ruling planet e.g. Shukra, Guru",
  "overview": "A concise, impactful 2-paragraph essence of what it means to have Moon in ${moonSign}. Focus on the core emotional drive and inner nature. Reference Vedic concepts briefly. Make it personal and insightful. Maximum 100 words.",
  "personalityTraits": [
    { "title": "Trait Name", "description": "1-2 sentence description", "emoji": "relevant emoji" },
    // Exactly 6 traits
  ],
  "emotionalNature": "A concise 1-2 paragraph description of the emotional landscape and inner needs. Maximum 60 words.",
  "strengths": ["Strength 1", "Strength 2", "Strength 3", "Strength 4", "Strength 5", "Strength 6"],
  "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3", "Weakness 4", "Weakness 5", "Weakness 6"],
  "compatibility": {
    "bestMatches": ["Sign1", "Sign2", "Sign3"],
    "goodMatches": ["Sign1", "Sign2"],
    "challengingMatches": ["Sign1", "Sign2"]
  },
  "luckyAttributes": {
    "color": "Lucky color",
    "number": "Lucky number(s)",
    "day": "Lucky day",
    "gemstone": "Recommended gemstone",
    "metal": "Lucky metal",
    "direction": "Lucky direction"
  },
  "moonMantra": "A relevant Vedic mantra for this moon sign",
  "nakshatraInsight": "A 2-sentence insight about how ${moonNakshatra} nakshatra further refines their Moon sign personality."
}

IMPORTANT RULES:
- All text must be deeply insightful, specific to ${moonSign}, NOT generic astrology.
- Personality traits should be unique and vivid, not cliché.
- Use traditional Vedic wisdom fused with modern psychological understanding.
- The person's name is ${birthDetails.name}. Reference them naturally in the overview.
- Moon is in house ${moonHouse} at ${moonDegree.toFixed ? moonDegree.toFixed(2) : moonDegree}° — use this for extra specificity.
- Respond with ONLY the JSON object. No preamble.`;

            const completion = await this.openai.chat.completions.create({
                model: this.MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Generate a comprehensive Moon Sign personality reading for ${birthDetails.name} whose Moon is in ${moonSign}, in Nakshatra ${moonNakshatra}, in the ${moonHouse} house at ${moonDegree}°.` }
                ],
                temperature: 0.4,
                max_tokens: 2000,
                response_format: { type: 'json_object' }
            });

            const content = completion.choices[0].message.content;
            const parsed = JSON.parse(content || '{}');

            return {
                ...parsed,
                rawAstro: {
                    moonSign,
                    moonNakshatra,
                    moonHouse,
                    moonDegree,
                    ascendant: astroData?.kundli?.ascendant,
                    sunSign: astroData?.panchang?.sun_sign,
                }
            };
        } catch (error) {
            this.logger.error('Error generating Moon Sign reading:', error);
            throw error;
        }
    }

    async getLoveReading(birthDetails: any): Promise<any> {
        try {
            this.logger.log(`❤️ [Love Horoscope] Generating personalized reading for ${birthDetails.name}...`);

            const coords = await this.astronomyService.geocodePlaceOfBirth(birthDetails.place);
            const astroData = await this.astronomyService.calculateAllData(
                birthDetails.date,
                birthDetails.time,
                String(coords.lat),
                String(coords.lon),
                birthDetails.tzone || 5.5
            );

            const venusData = astroData?.kundli?.planets?.Venus || {};
            const marsData = astroData?.kundli?.planets?.Mars || {};
            const jupiterData = astroData?.kundli?.planets?.Jupiter || {};
            const moonData = astroData?.kundli?.planets?.Moon || {};

            const seventhHouseData = astroData?.kundli?.houses?.[7] || {};
            const seventhHouseLord = seventhHouseData?.lord || 'Unknown';
            const seventhHouseSign = seventhHouseData?.sign || 'Unknown';

            const systemPrompt = `You are a Master Vedic Relationship Counselor. You MUST respond with ONLY a raw JSON object. No markdown, no backticks, no preamble. Your entire response must be parseable by JSON.parse().

OUTPUT JSON STRUCTURE (STRICT):
{
  "name": "${birthDetails.name}",
  "keyPlacements": {
    "venus": "Venus in ${venusData.sign} (${venusData.house} House)",
    "mars": "Mars in ${marsData.sign} (${marsData.house} House)",
    "jupiter": "Jupiter in ${jupiterData.sign} (${jupiterData.house} House)",
    "moon": "Moon in ${moonData.sign} (${moonData.house} House)",
    "marriageLord": "${seventhHouseLord} (Ruler of the 7th House in ${seventhHouseSign})"
  },
  "loveLanguage": "A 2-sentence description of the user's love language based on these placements.",
  "romanticArchetype": {
    "title": "The [Archetype Name] e.g. The Soulmate Hunter, The Loyal Guardian",
    "description": "A 3-sentence deep dive into their romantic personality."
  },
  "sections": [
    {
      "title": "Love Life Overview",
      "content": "A high-level overview of their relationship potential based on the 7th and 5th houses. Use Jupiter for stability and Moon for emotional depth. Max 100 words."
    },
    {
      "title": "For Committed Relationships",
      "content": "Advice for couples. Analyze the strength of the 7th house lord (${seventhHouseLord}) and Jupiter. Max 80 words."
    },
    {
      "title": "For Singles",
      "content": "Advice for those looking. Use Venus and Mars energy to guide their dating path. Max 80 words."
    },
    {
      "title": "Relationship Advice & Remedies",
      "content": "Vedic remedies (donations, mantras, behaviors) specifically for their weakest link among Venus, Jupiter, or the 7th House Lord. Max 80 words."
    }
  ],
  "soulmateTraits": ["Trait 1", "Trait 2", "Trait 3", "Trait 4"],
  "timingInsight": "A specific 2-sentence prediction about their current 'Romantic Window' based on Dashas."
}

IMPORTANT RULES:
- The person's name is ${birthDetails.name}.
- Analyze the synergy between Venus (Passion), Moon (Emotion), and Jupiter (Stability).
- Use the 7th house lord ${seventhHouseLord} to describe the "Energy" of their future partner.
- Respond with ONLY the JSON object. No preamble.`;

            const completion = await this.openai.chat.completions.create({
                model: this.MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Analyze the love life and relationship path for ${birthDetails.name} using their birth chart data.` }
                ],
                temperature: 0.5,
                response_format: { type: 'json_object' }
            });

            return JSON.parse(completion.choices[0].message.content || '{}');
        } catch (error) {
            this.logger.error('Error generating personalized Love Reading:', error);
            throw error;
        }
    }

    async getZodiacLoveReading(zodiacSign: string, period: string = 'daily', language: string = 'English'): Promise<any> {
        try {
            // Fetch the permanent personality profile from DB
            const zodiacProfile = await this.horoscopeService.getZodiacProfile(zodiacSign);
            let finalReading: any = null;

            // 1. Check for manual override first
            const date = new Date();
            const p = period.toLowerCase();
            if (p === 'tomorrow') {
                date.setDate(date.getDate() + 1);
            }
            if (p === 'yesterday') {
                date.setDate(date.getDate() - 1);
            }
            // For weekly, normalize to the start of the week (Monday) to ensure consistent caching
            if (p === 'weekly') {
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                date.setDate(diff);
            }
            const targetDateStr = date.toISOString().split('T')[0];

            const manualOverride = await this.horoscopeService.getManualOverride(zodiacSign, period, targetDateStr);
            if (manualOverride) {
                this.logger.log(`🌟 [Zodiac Love] Using MANUAL override for ${zodiacSign} (${period})`);
                finalReading = manualOverride;
            }

            // 2. Check for AI Cache
            if (!finalReading) {
                const cachedResult = await this.horoscopeService.getAiCache(zodiacSign, period, targetDateStr);
                if (cachedResult) {
                    this.logger.log(`💾 [Zodiac Love] Serving CACHED AI result for ${zodiacSign} (${period})`);
                    finalReading = cachedResult;
                }
            }

            // 3. Generate New AI Reading
            if (!finalReading) {
                this.logger.log(`♈ [Zodiac Love] Generating NEW ${period} reading for ${zodiacSign} in ${language}...`);

                const periodContext = period.toLowerCase() === 'weekly'
                    ? "This is a WEEKLY forecast. Focus on the 7-day arc, major planetary transits over the next week, and broader relationship trends."
                    : period.toLowerCase() === 'tomorrow'
                        ? "This is a TOMORROW forecast. Focus specifically on the upcoming energy for the next day."
                        : "This is a DAILY forecast. Focus on the immediate aura, moon-sign vibe for TODAY, and quick daily tips.";

                const systemPrompt = `You are a Master Vedic Relationship Counselor. You MUST respond with ONLY a raw JSON object in ${language}. 

PERIOD SPECIALIZATION:
${periodContext}

OUTPUT JSON STRUCTURE (STRICT):
{
  "sign": "${zodiacSign}",
  "period": "${period}",
  "todayDate": "${targetDateStr}",
  "loveScore": 0-100,
  "vibeName": "One word vibe appropriate for this period",
  "prediction": "A high-quality 3-sentence summary of the ${period} love energy.",
  "forCouples": "Deep advice for couples for this ${period}. Max 60 words.",
  "forSingles": "Advice for singles for this ${period}. Max 60 words.",
  "relationshipAdvice": "A powerful Vedic relationship tip for this ${period}. Max 50 words.",
  "luckyColor": "Lucky romantic color",
  "luckyTime": "Best time for connection",
  "luckyNumber": "Lucky love number"
}

IMPORTANT:
- Stick to the ${period} timeframe. 
- Do NOT generate same content for Weekly and Daily. 
- Language: ${language}.
- Temperature stability mode: enabled.`;

                const completion = await this.openai.chat.completions.create({
                    model: this.MODEL_NAME,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `Generate as a Vedic Master: ${period} love horoscope for ${zodiacSign}. Date: ${targetDateStr}` }
                    ],
                    temperature: 0.3,
                    response_format: { type: 'json_object' }
                });

                const result = JSON.parse(completion.choices[0].message.content || '{}');

                await this.horoscopeService.setAiCache({
                    ...result,
                    targetDate: targetDateStr
                });

                finalReading = this.horoscopeService.mapEntryToResponse(result, 'ai-generated');
            }

            // Embed the static profile into the dynamic response
            return {
                ...finalReading,
                profile: zodiacProfile
            };
        } catch (error) {
            this.logger.error('Error generating Zodiac Love Reading:', error);
            throw error;
        }
    }

    /**
     * CHINESE ASTROLOGY: Generates a reading for a specific animal sign (Rat, Ox, etc.)
     */
    async getChineseZodiacReading(sign: string, period: string = 'daily', language: string = 'English'): Promise<any> {
        try {
            const date = new Date();
            const p = period.toLowerCase();
            if (p === 'tomorrow') date.setDate(date.getDate() + 1);
            if (p === 'yesterday') date.setDate(date.getDate() - 1);

            // For weekly, normalize to the start of the week (Monday) to ensure consistent caching
            if (p === 'weekly') {
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                date.setDate(diff);
            }

            const targetDateStr = date.toISOString().split('T')[0];

            // 1. Check manual override
            const manual = await this.horoscopeService.getChineseManualOverride(sign, period, targetDateStr);
            if (manual) return manual;

            // 2. Check cache
            const cached = await this.horoscopeService.getChineseAiCache(sign, period, targetDateStr);
            if (cached) return cached;

            // 3. Generate NEW
            this.logger.log(`🏮 [Chinese Horoscope] Generating ${period} for ${sign}...`);

            const systemPrompt = `You are a Grand Master of Chinese Astrology and Feng Shui. You MUST respond with ONLY a raw JSON object in ${language}.
      
      SIGN: ${sign}
      PERIOD: ${period}
      DATE: ${targetDateStr}

      FOCUS: Use the traditional 12-animal cycle wisdom. Provide guidance on Qi flow, Yin-Yang balance, and elemental interactions.

      OUTPUT JSON STRUCTURE:
      {
        "sign": "${sign}",
        "period": "${period}",
        "todayDate": "${targetDateStr}",
        "vibeScore": 0-100,
        "vibeName": "A traditional Chinese wisdom word (e.g., Harmony, Abundance, Caution)",
        "prediction": "A unified, comprehensive narrative of 120-150 words covering luck, career, romance, and spiritual energy for this ${period} in a single paragraph.",
        "luckyColor": "Lucky color",
        "luckyTime": "Auspicious hour",
        "luckyNumber": "Fortune number",
        "forRelationships": "",
        "forSingles": "",
        "careerInsight": ""
      }`;

            const completion = await this.openai.chat.completions.create({
                model: this.MODEL_NAME,
                messages: [{ role: 'system', content: systemPrompt }],
                temperature: 0.4,
                response_format: { type: 'json_object' }
            });

            const result = JSON.parse(completion.choices[0].message.content || '{}');
            await this.horoscopeService.setChineseAiCache({ ...result, targetDate: targetDateStr });

            // Transform result for frontend consumption (adds 'sections' and 'luckyElements')
            return (this.horoscopeService as any).transformChineseResponse(result, 'ai-generated');
        } catch (error) {
            this.logger.error('Error in getChineseZodiacReading:', error);
            throw error;
        }
    }

    /**
     * CHINESE ASTROLOGY: Deep personal reading based on DOB
     */
    private personalChineseCache = new Map<string, { timestamp: number, data: any }>();

    async getPersonalChineseReading(name: string, dob: string, language: string = 'English'): Promise<any> {
        try {
            // Check in-memory cache first (valid for 24 hours)
            const cacheKey = `${name}_${dob}_${language}`;
            const cached = this.personalChineseCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
                this.logger.log(`🐉 [Personal Chinese] Serving CACHED reading for ${name}`);
                return cached.data;
            }

            this.logger.log(`🐉 [Personal Chinese] Analyzing destiny for ${name} (${dob})...`);

            const systemPrompt = `You are a Grand Master of Chinese Astrology. Use the Bazi (Four Pillars of Destiny) principles to analyze this user.
      
      USER: ${name}
      DATE OF BIRTH: ${dob}

      TASKS:
      1. Identify their Chinese Zodiac Animal and intrinsic Element (Wood, Fire, Earth, Metal, Water).
      2. Provide a 5-sentence "Destiny Path" analysis.
      3. List 3 key strengths and 3 hidden weaknesses.
      4. Suggest a life-improving Feng Shui tip based on their element.

      OUTPUT JSON STRUCTURE:
      {
        "userName": "${name}",
        "animal": "Animal Name",
        "element": "Birth Element",
        "destinyPath": "Deep analysis text...",
        "personality": {
          "traits": ["Trait 1", "Trait 2", "Trait 3"],
          "shadows": ["Weakness 1", "Weakness 2", "Weakness 3"]
        },
        "fengShuiTip": "Tip text...",
        "luckyElements": {
          "color": "String",
          "direction": "Compass direction",
          "careerField": "Industry"
        }
      }`;

            const completion = await this.openai.chat.completions.create({
                model: this.MODEL_NAME,
                messages: [{ role: 'system', content: systemPrompt }],
                temperature: 0.6,
                response_format: { type: 'json_object' }
            });

            const result = JSON.parse(completion.choices[0].message.content || '{}');

            // Safety Net: Max 1000 entries to prevent memory leak during traffic spikes
            if (this.personalChineseCache.size >= 1000) {
                const oldestKey = this.personalChineseCache.keys().next().value;
                if (oldestKey) this.personalChineseCache.delete(oldestKey);
            }

            // Save to cache
            this.personalChineseCache.set(cacheKey, { timestamp: Date.now(), data: result });

            return result;
        } catch (error) {
            this.logger.error('Error in getPersonalChineseReading:', error);
            throw error;
        }
    }

    /**
     * Generates a short, spiritual "vibe" or verdict for a specific Muhurat date.
     */
    async generateMuhuratVerdict(
        category: string,
        data: {
            date: string;
            tithi: string;
            nakshatra: string;
            yoga: string;
            karana: string;
            muhurat_start: string;
            muhurat_end: string;
        },
        customPrompt?: string,
        language: string = 'English'
    ): Promise<string> {
        try {
            this.logger.log(`🌟 [AI Engine] Generating Muhurat Verdict for ${category} on ${data.date}...`);

            const systemPrompt = `
      You are a Vedic Astrology Expert specializing in Muhurta (Auspicious Timing).
      
      TASK: 
      Generate a single, short, and powerful spiritual "verdict" for a ${category} Muhurat.
      
      INPUT DATA:
      - Category: ${category}
      - Date: ${data.date}
      - Tithi: ${data.tithi}
      - Nakshatra: ${data.nakshatra}
      - Yoga: ${data.yoga}
      - Karana: ${data.karana}
      - Timing: ${data.muhurat_start} to ${data.muhurat_end}
      
      RULES:
      1. Be warm, spiritual, and authoritative.
      2. Briefly explain the vibe of this specific combination.
      3. Keep it strictly to ONE short sentence (maximum 15 words).
      4. Avoid robotic lists. Write like a human astrologer.
      5. Language: Strictly respond in ${language}.
      ${customPrompt ? `6. ADDITIONAL STYLE INSTRUCTION: ${customPrompt}` : ''}
      `;

            const completion = await this.openai.chat.completions.create({
                model: this.MODEL_NAME,
                messages: [{ role: 'system', content: systemPrompt }],
                max_tokens: 150,
                temperature: 0.7,
            });

            return completion.choices[0].message.content?.trim() || 'A truly auspicious window for your new beginnings.';
        } catch (error) {
            this.logger.error('Error in generateMuhuratVerdict:', error);
            return 'An auspicious combination of celestial energies favors your journey.';
        }
    }

    /**
     * Generates a structural one-off compatibility report (JSON).
     * This is used for guest access and quick lookups without a full chat session.
     */
    async getCompatibilityAnalysis(query: string, language: string = 'English'): Promise<any> {
        try {
            this.logger.log(`💖 [AI Engine] Generating structural compatibility analysis...`);

            const systemPrompt = `You are a Master Vedic Relationship Counselor. 
      Your task is to provide a comprehensive, warm, and professional love compatibility report in JSON format.
      
      RULES:
      1. Response Format: STRICT JSON ONLY.
      2. Language: Always respond in ${language}.
      3. Tone: Direct, soulful, and encouraging.
      4. Length limits:
         - deepInsight: Exactly 2-3 concise sentences.
         - chemistry: Exactly 1-2 concise sentences.
         - dynamic: Exactly 1-2 concise sentences.
         - strengths: Exactly 3 short bullet points (strings).
         - challenges: Exactly 2-3 short bullet points (strings).
         - advice: Exactly 1-2 concise sentences.
      
      JSON SCHEMA:
      {
        "deepInsight": "string",
        "chemistry": "string",
        "dynamic": "string",
        "strengths": ["string", "string", "string"],
        "challenges": ["string", "string", "string"],
        "advice": "string"
      }
      
      Do NOT include markdown formatting in the JSON values. Keep it very punchy and short.`;

            const completion = await this.openai.chat.completions.create({
                model: this.MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: query }
                ],
                max_tokens: 600,
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            const content = (completion.choices[0].message.content || '{}').trim();
            return JSON.parse(content);
        } catch (error) {
            this.logger.error('Error generating compatibility analysis JSON:', error);
            return null;
        }
    }

    /**
     * Generates a structural one-off name compatibility report (JSON).
     */
    async getNameCompatibilityAnalysis(query: string, language: string = 'English'): Promise<any> {
        try {
            this.logger.log(`💖 [AI Engine] Generating structural name compatibility analysis...`);

            const systemPrompt = `You are an Expert Numerologist specializing in the Chaldean system and Planetary Archetypes.
      Your task is to provide a comprehensive, insightful, and professional name compatibility report in JSON format.
      
      RULES:
      1. Response Format: STRICT JSON ONLY.
      2. Language: Always respond in ${language}.
      3. Tone: Insightful, encouraging, and sophisticated.
      4. Length limits:
         - deepInsight: Exactly 2-3 concise sentences explaining the vibrational match.
         - chemistry: Exactly 1-2 concise sentences about the mutual attraction.
         - dynamic: Exactly 1-2 concise sentences about daily interaction.
         - strengths: Exactly 3 short bullet points (strings).
         - challenges: Exactly 2-3 short bullet points (strings).
         - advice: Exactly 1-2 concise sentences of Vedic/Numerological guidance.
      
      JSON SCHEMA:
      {
        "deepInsight": "string",
        "chemistry": "string",
        "dynamic": "string",
        "strengths": ["string", "string", "string"],
        "challenges": ["string", "string", "string"],
        "advice": "string"
      }
      
      Focus on how the two specific planetary archetypes and name numbers interact. Keep it very punchy and short.`;

            const completion = await this.openai.chat.completions.create({
                model: this.MODEL_NAME,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: query }
                ],
                max_tokens: 500,
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            const content = (completion.choices[0].message.content || '{}').trim();
            return JSON.parse(content);
        } catch (error) {
            this.logger.error('Error generating name compatibility analysis JSON:', error);
            return null;
        }
    }
    /**
     * ✅ Generates a Voice-Optimized System Prompt (Unified Brain)
     * This ensures Voice AI has the same depth as Chat but speaks naturally.
     */
    async getVoiceSystemPrompt(
        astrologerProfile: any,
        userBirthDetails: {
            dateOfBirth: string;
            timeOfBirth: string;
            placeOfBirth: string;
            name: string;
        },
        language: string = 'English'
    ): Promise<string> {
        try {
            // 1. Detect and Normalize Expertise (Vedic, Tarot, Numerology)
            let rawExpertise = astrologerProfile.expertise || 'Vedic';
            let expertise = rawExpertise.charAt(0).toUpperCase() + rawExpertise.slice(1).toLowerCase();

            if (!['Vedic', 'Tarot', 'Numerology'].includes(expertise)) {
                expertise = 'Vedic';
            }
            const currentYear = new Date().getFullYear();

            // 2. Build Persona (Shared with Chat)
            const personaPrompt = this.buildPersonaPrompt(
                { ...astrologerProfile, expertise },
                language,
                currentYear,
                true // isVoice = true
            );

            // 3. Resolve actual coordinates for the user's birth place
            let lat: string | null = null;
            let lon: string | null = null;
            try {
                if (userBirthDetails.placeOfBirth) {
                    const coords = await this.astronomyService.geocodePlaceOfBirth(userBirthDetails.placeOfBirth);
                    lat = String(coords.lat);
                    lon = String(coords.lon);
                }
            } catch (e) { }

            // 4. Calculate Detailed Astro Data
            let allAstroData = null;
            if (lat && lon) {
                try {
                    allAstroData = await this.astronomyService.calculateAllData(
                        userBirthDetails.dateOfBirth,
                        userBirthDetails.timeOfBirth,
                        lat,
                        lon
                    );
                } catch (e) { }
            }

            // 5. Build Astro Context (Shared with Chat)
            const astroContext = this.buildAstroContext(
                {
                    ...(allAstroData || {}),
                    name: userBirthDetails.name,
                    dob: userBirthDetails.dateOfBirth,
                    tob: userBirthDetails.timeOfBirth,
                    pob: userBirthDetails.placeOfBirth
                },
                'general',
                expertise
            );

            // 6. Voice-Specific Formatting Rules (Stripping Markdown/JSON)
            const personaGuard = expertise === 'Vedic'
                ? `You are a VEDIC ASTROLOGER. NEVER mention Tarot, cards, or generic fortune-telling. Use only Vedic concepts (Kundli, Grahas, Doshas).`
                : expertise === 'Tarot'
                    ? `You are a TAROT READER. Use your cards to guide the user. Do not use Vedic astrology terms like Grahas or Nakshatras unless relevant.`
                    : expertise === 'Numerology'
                        ? `You are a NUMEROLOGIST. Focus on numbers, birth dates, and name meanings. Do not use cards or Vedic Grahas unless relevant.`
                        : `You are an expert in ${expertise}. Stay true to your specialty.`;

            const voiceRules = `
            CRITICAL RULES FOR VOICE CONVERSATION:
            1. **DIRECT ANSWER FIRST**: Answer the user's specific question in the VERY FIRST sentence. Do NOT start with a personality dump or chart overview.
            2. **NO MARKDOWN**: Never use asterisks, bolding, hashtags, or bullet points. Speak in clear, natural plain text sentences.
            3. **CONCISE**: Keep every response under 3-4 sentences (max 150 words). Do not provide long reports.
            4. **NO TEMPLATES**: Do NOT use fixed sections like "Your Personality", "Auspicious Yogas". Just answer naturally like a real astrologer on a phone call.
            5. **GREETING**: Greet the user by FIRST name only (not full name) ONLY in your very first response.
            6. **ENGAGE**: End with ONE short follow-up question to keep the conversation going.
            7. **SPECIFICITY (CRITICAL)**:
               - NEVER give vague answers. Every answer must reference specific data from the birth chart (house number, planet name, Dasha period with start/end years).
               - For ANY timing question: Always provide specific YEAR RANGES from the Dasha/Antardasha data. Never say vague phrases like "jaldi", "abhi sahi hai", or "aane wale samay mein".
               - For ANY prediction question: Give a firm, data-driven answer. Never say generic things like "achha hoga" or "sab theek hoga".
               - For ANY "should I" question: Give a clear YES or NO first, then explain why using chart data.
            8. **CONVERSATIONAL**: Do not say "what is your question?" or make meta-comments. Just converse naturally like a human.
            9. **${expertise.toUpperCase()} FOCUS**: Always anchor your advice in your specific field of expertise and the provided birth energy data.
            10. **LANGUAGE & SCRIPT (DYNAMIC)**: Speak primarily in ${language}. If the user switches language, switch with them smoothly. CRITICAL: Respect script parity. If the user writes/speaks in Hindi (Devanagari), your response MUST be strictly in Devanagari script. If they use Hinglish/Roman script, respond in Roman script. Never mix scripts unless the user does.
            11. **STORE RECOMMENDATION (CONDITIONAL)**: ONLY when the user explicitly asks about remedies, gemstones, or puja solutions, recommend our official store https://vaidiktalk.store/. Do NOT bring up the store during greetings, general readings, or predictions. Keep it contextually relevant.
            `.trim();

            return `
            ${personaPrompt}
            
            ${astroContext}
            
            ${voiceRules}
            `.trim();
        } catch (error) {
            this.logger.error('❌ Failed to generate Voice System Prompt:', error);
            return 'You are a professional Vedic astrologer. Provide brief, spiritual guidance based on the seeker\'s birth data.';
        }
    }
}
