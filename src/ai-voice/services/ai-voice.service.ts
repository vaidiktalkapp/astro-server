import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { AiAstrologerProfile, AiAstrologerProfileDocument } from '../../ai-astrologers/schemas/ai-astrologers-profile.schema';
import { CallSession, CallSessionDocument } from '../../calls/schemas/call-session.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { SystemSettings, SystemSettingsDocument } from '../../payments/schemas/system-settings.schema';
import { AgoraService } from '../../calls/services/agora.service';
import { WalletService } from '../../payments/services/wallet.service';
import { AstronomyService } from '../../ai-astrologers/services/astronomy.service';
import { AiAstrologyEngineService } from '../../ai-astrologers/services/ai-astrology-engine.service';
import { GeminiVoiceService } from './gemini-voice.service';
import { CallSessionService } from '../../calls/services/call-session.service';
import { OrdersService } from '../../orders/services/orders.service';

@Injectable()
export class AiVoiceService {
  private readonly logger = new Logger(AiVoiceService.name);
  private readonly vapiApiKey: string;
  private readonly vapiBaseUrl = 'https://api.vapi.ai';

  constructor(
    private configService: ConfigService,
    private agoraService: AgoraService,
    private walletService: WalletService,
    private astronomyService: AstronomyService,
    private aiAstrologyEngine: AiAstrologyEngineService,
    private geminiVoiceService: GeminiVoiceService,
    @Inject(forwardRef(() => CallSessionService))
    private callSessionService: CallSessionService,
    @InjectModel(AiAstrologerProfile.name)
    private aiProfileModel: Model<AiAstrologerProfileDocument>,
    @InjectModel(CallSession.name)
    private sessionModel: Model<CallSessionDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(SystemSettings.name)
    private systemSettingsModel: Model<SystemSettingsDocument>,
    private ordersService: OrdersService,
  ) {
    this.vapiApiKey = this.configService.get<string>('VAPI_API_KEY') || '';
    if (!this.vapiApiKey) {
      this.logger.warn('Vapi API Key not configured');
    }
  }

  /**
   * ✅ Initiate an AI Voice Call into an Agora Channel
   */
  async initiateAiVoiceCall(userId: string, aiId: string, language: string = 'English', intakeData?: any): Promise<any> {
    // 1. Validate ID formats
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid userId format. Must be a 24-character hex string.');
    }
    if (!Types.ObjectId.isValid(aiId)) {
      throw new BadRequestException('Invalid aiId format. Must be a 24-character hex string.');
    }

    // 2. Validate User & AI Profile
    const [user, aiProfile] = await Promise.all([
      this.userModel.findById(userId),
      this.aiProfileModel.findById(aiId),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!aiProfile) throw new NotFoundException('AI Astrologer not found');

    // Check if Call is enabled
    if (aiProfile.isCallEnabled === false) {
      throw new BadRequestException('Voice calls are currently disabled for this AI Astrologer.');
    }

    let ratePerMinute = aiProfile.callRatePerMinute || aiProfile.ratePerMinute || 10;
    let maxDurationSeconds = 0;

    const settings = await this.systemSettingsModel.findOne();
    const isFreeEnabled = settings ? (settings.isAiFirstCallFreeEnabled ?? false) : false;
    const freeDurationMinutes = settings ? (settings.aiFirstCallFreeDurationMinutes ?? 1) : 1;

    if (isFreeEnabled && !user.isAiFirstConsultationUsed) {
      ratePerMinute = 0;
      maxDurationSeconds = freeDurationMinutes * 60;
    } else {
      const minBalanceRequired = ratePerMinute * 5;
      const hasBalance = await this.walletService.checkBalance(userId, minBalanceRequired);

      if (!hasBalance) {
        throw new BadRequestException(`Insufficient balance. Minimum ₹${minBalanceRequired} required.`);
      }
      maxDurationSeconds = Math.floor((user.wallet?.balance || 0) / ratePerMinute) * 60;
    }

    // 3. Create Unique Channel/Session ID
    const channelName = `AI_VOICE_${Date.now()}_${userId.substring(18)}`;

    // 4. Create Call Session Record in Database
    const now = new Date();

    // Use intakeData birth details if provided, otherwise fallback to user profile
    const birthDetails = intakeData ? {
      name: intakeData.name,
      dateOfBirth: intakeData.dateOfBirth,
      timeOfBirth: intakeData.timeOfBirth,
      placeOfBirth: intakeData.placeOfBirth,
      query: intakeData.query,
    } : {
      name: user.name || 'Seeker',
      dateOfBirth: user.dateOfBirth?.toISOString().split('T')[0] || '',
      timeOfBirth: user.timeOfBirth || '',
      placeOfBirth: user.placeOfBirth || '',
    };

    // 4. Find or Create a Conversation Thread (Order) for this AI-User pair
    const order = await this.ordersService.findOrCreateConversationThread(
      userId,
      aiId,
      aiProfile.name,
      ratePerMinute,
      'AiAstrologerProfile'
    );

    const session = await this.sessionModel.create({
      sessionId: channelName,
      userId: new Types.ObjectId(userId),
      astrologerId: new Types.ObjectId(aiId),
      astrologerModel: 'AiAstrologerProfile',
      orderId: order.orderId,
      conversationThreadId: order.conversationThreadId,
      callType: 'audio',
      status: 'active',
      isAi: true,
      ratePerMinute: ratePerMinute,
      startTime: now,
      requestCreatedAt: now,
      maxDurationSeconds: maxDurationSeconds,
      maxDurationMinutes: Math.floor(maxDurationSeconds / 60),
      userBirthChart: birthDetails,
    });

    if (session) {
      this.logger.log(`✅ AI Call Session created: ${session.sessionId} for user ${userId}`);
    } else {
      this.logger.error(`❌ Failed to create AI Call Session for user ${userId}`);
    }
    // 5. Determine Language
    const callLanguage = language || (aiProfile.languages?.[0] || 'English');

    // ✅ NEW: Look for a recently disconnected call within 2 minutes to inject Context (reconnection)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentSession = await this.sessionModel.findOne({
      userId: new Types.ObjectId(userId),
      astrologerId: new Types.ObjectId(aiId),
      isAi: true,
      transcript: { $exists: true, $ne: '' },
      createdAt: { $gte: twoMinutesAgo }
    }).sort({ createdAt: -1 });

    let previousTranscriptContext = '';
    let shouldSkipGreeting = false;

    if (recentSession && recentSession.transcript) {
        previousTranscriptContext = `
[SYSTEM INSTRUCTION: The previous call with this user disconnected due to a network issue. Below is the transcript of that previous call. Resume the conversation naturally from exactly where it left off. DO NOT repeat your introduction.]

--- PREVIOUS CALL TRANSCRIPT ---
${recentSession.transcript}
--------------------------------
`.trim();
        shouldSkipGreeting = true;
        this.logger.log(`🔄 Found previous session ${recentSession.sessionId} with transcript. Resuming context.`);
    }

    // 6. Generate Dynamic Greeting using AI Engine (or use reconnect message)
    let dynamicGreeting = '';
    if (shouldSkipGreeting) {
        dynamicGreeting = callLanguage.toLowerCase().includes('hi') ? 
            "Call disconnect ho gayi thi. Chaliye wahi se aage badhte hain." : 
            "Sorry, the call disconnected. Let's continue from where we left off.";
    } else {
        dynamicGreeting = await this.aiAstrologyEngine.generateDynamicGreeting(birthDetails.name || 'Seeker', callLanguage, aiProfile);
    }

    // 7. Build Unified System Prompt using the shared AI Engine
    const masterPrompt = await this.aiAstrologyEngine.getVoiceSystemPrompt(
      aiProfile,
      birthDetails,
      callLanguage
    );


    const languageMapping: Record<string, { 
      transcriber: string, 
      femaleVoice: string, 
      maleVoice: string, 
      provider: string 
    }> = {
      'English': { transcriber: 'en', femaleVoice: 'en-IN-NeerjaNeural', maleVoice: 'en-IN-PrabhatNeural', provider: 'azure' },
      'en': { transcriber: 'en', femaleVoice: 'en-IN-NeerjaNeural', maleVoice: 'en-IN-PrabhatNeural', provider: 'azure' },
      'Hindi': { transcriber: 'hi', femaleVoice: 'hi-IN-SwaraNeural', maleVoice: 'hi-IN-MadhurNeural', provider: 'azure' },
      'hi': { transcriber: 'hi', femaleVoice: 'hi-IN-SwaraNeural', maleVoice: 'hi-IN-MadhurNeural', provider: 'azure' },
      'Marathi': { transcriber: 'mr', femaleVoice: 'mr-IN-AarohiNeural', maleVoice: 'mr-IN-ManoharNeural', provider: 'azure' },
      'mr': { transcriber: 'mr', femaleVoice: 'mr-IN-AarohiNeural', maleVoice: 'mr-IN-ManoharNeural', provider: 'azure' },
      'Gujarati': { transcriber: 'gu', femaleVoice: 'gu-IN-DhwaniNeural', maleVoice: 'gu-IN-NiranjanNeural', provider: 'azure' },
      'gu': { transcriber: 'gu', femaleVoice: 'gu-IN-DhwaniNeural', maleVoice: 'gu-IN-NiranjanNeural', provider: 'azure' },
      'Tamil': { transcriber: 'ta', femaleVoice: 'ta-IN-PallaviNeural', maleVoice: 'ta-IN-ValluvarNeural', provider: 'azure' },
      'ta': { transcriber: 'ta', femaleVoice: 'ta-IN-PallaviNeural', maleVoice: 'ta-IN-ValluvarNeural', provider: 'azure' },
      'Telugu': { transcriber: 'te', femaleVoice: 'te-IN-ShrutiNeural', maleVoice: 'te-IN-MohanNeural', provider: 'azure' },
      'te': { transcriber: 'te', femaleVoice: 'te-IN-ShrutiNeural', maleVoice: 'te-IN-MohanNeural', provider: 'azure' },
      'Bengali': { transcriber: 'bn', femaleVoice: 'bn-IN-TanishaNeural', maleVoice: 'bn-IN-BashkarNeural', provider: 'azure' },
      'bn': { transcriber: 'bn', femaleVoice: 'bn-IN-TanishaNeural', maleVoice: 'bn-IN-BashkarNeural', provider: 'azure' },
      'Kannada': { transcriber: 'kn', femaleVoice: 'kn-IN-SapnaNeural', maleVoice: 'kn-IN-GaganNeural', provider: 'azure' },
      'kn': { transcriber: 'kn', femaleVoice: 'kn-IN-SapnaNeural', maleVoice: 'kn-IN-GaganNeural', provider: 'azure' },
      'Malayalam': { transcriber: 'ml', femaleVoice: 'ml-IN-SobhanaNeural', maleVoice: 'ml-IN-MidhunNeural', provider: 'azure' },
      'ml': { transcriber: 'ml', femaleVoice: 'ml-IN-SobhanaNeural', maleVoice: 'ml-IN-MidhunNeural', provider: 'azure' },
    };

    const langConfig = languageMapping[callLanguage] || languageMapping['English'];
    const isFemale = aiProfile.gender === 'female';

    // 9. Determine Voice and Provider (Admin Overrides)
    let finalVoiceId = aiProfile.voiceId || (isFemale ? langConfig.femaleVoice : langConfig.maleVoice);
    let finalProvider = langConfig.provider;
    const finalTranscriber = langConfig.transcriber;

    // Determine Provider based on Voice ID if not explicitly forced, 
    // or use a smart heuristic if the ID looks like Azure vs ElevenLabs
    if (finalVoiceId.includes('-') || finalVoiceId.includes('_')) {
      finalProvider = 'azure';
    } else {
      finalProvider = '11labs';
    }

    // 10. Decide between Gemini and Vapi
    const voiceProvider = aiProfile.voiceProvider || 'vapi'; // Default changed to vapi
    
    this.logger.log(`🚀 [AiVoiceService] Initiating call for AI: ${aiProfile.name} (${aiProfile._id})`);
    this.logger.log(`🎭 Config: Provider=${voiceProvider}, Engine=${finalProvider}, Voice=${finalVoiceId}, Lang=${callLanguage}`);
    this.logger.log(`📦 Intake: ${JSON.stringify(birthDetails)}`);

    if (voiceProvider === 'gemini') {
      const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (!geminiApiKey) {
        this.logger.warn('❌ [AiVoiceService] GEMINI_API_KEY is MISSING in .env!');
      } else {
        this.logger.log(`✅ [AiVoiceService] Loaded Gemini API Key (Suffix: ...${geminiApiKey.slice(-4)})`);
        const cleanPrompt = this.geminiVoiceService.getCleanVoicePrompt(masterPrompt);

        // Build intake context so AI has user's birth + consultation details
        const intakeContext = `
USER CONSULTATION DETAILS (use this for the entire session):
- Name: ${birthDetails.name}
- Date of Birth: ${birthDetails.dateOfBirth}
- Time of Birth: ${birthDetails.timeOfBirth || 'Not provided'}
- Place of Birth: ${birthDetails.placeOfBirth || 'Not provided'}
${birthDetails.query ? `- Additional Details: ${birthDetails.query}` : ''}

USER PREFERRED LANGUAGE: ${callLanguage}
(CRITICAL: Start the call by greeting strictly in ${callLanguage}. However, you are a multilingual expert. If the user speaks in ANY other language like Hindi, English, or Hinglish, switch to their language naturally and immediately. 
- English input → English reply
- Hindi/Hinglish input → Reply in Hindi but ALWAYS use Roman script (Hinglish). NEVER use Devanagari script.
NEVER refuse to answer because of a language choice. Stay in their chosen language for the remainder of the session unless they switch again. Do not repeat greeting patterns after the first message).

${previousTranscriptContext}
`.trim();

        session.voiceProvider = 'gemini';
        session.aiConfig = {
          apiKey: geminiApiKey,
          systemInstruction: `${cleanPrompt}\n\n${aiProfile.systemPromptAddition || ''}\n\n${intakeContext}`,
          tools: this.geminiVoiceService.getGeminiTools(),
          firstMessage: dynamicGreeting,
          maxDurationSeconds: session.maxDurationSeconds,
          voiceName: isFemale ? 'Aoede' : 'Charon',
        };
        await session.save();

        return {
          success: true,
          sessionId: channelName,
          orderId: session.orderId,
          astrologerId: session.astrologerId,
          astrologerImage: aiProfile.image,
          provider: 'gemini',
          geminiConfig: {
            systemInstruction: session.aiConfig.systemInstruction,
            tools: session.aiConfig.tools,
            firstMessage: session.aiConfig.firstMessage,
            maxDurationSeconds: session.aiConfig.maxDurationSeconds,
          },
        };
      }
    }

    // ─── Vapi Config (Fallback or explicitly selected) ───
    const vapiIntakeContext = `
YOU ARE A VAIDIK AI ASTROLOGER.
- Always reply in the same language as the user.
- If user speaks Hindi or Hinglish, respond in Hindi/Hinglish only.
- NEVER switch to Spanish, French, or any other language.
- Keep responses natural, short, and conversational.
- If transcript contains mixed Hindi-English words, treat it as Hinglish and respond accordingly.

USER CONSULTATION DETAILS (use this for the entire call session):
- Name: ${birthDetails.name}
- Date of Birth: ${birthDetails.dateOfBirth}
- Time of Birth: ${birthDetails.timeOfBirth || 'Not provided'}
- Place of Birth: ${birthDetails.placeOfBirth || 'Not provided'}
${birthDetails.query ? `- Additional Details: ${birthDetails.query}` : ''}

SESSION START LANGUAGE: ${callLanguage}
LANGUAGE RULES (CRITICAL — follow for EVERY response):
1. Detect user spoken language dynamically.
2. If user speaks Hindi/Hinglish, you must reply ONLY in Hindi/Hinglish.
3. English input → English reply.
4. Hindi/Hinglish input → Reply in Hindi but ALWAYS use Roman script (Hinglish). NEVER use Devanagari script, as the text-to-speech engine will fail.
5. Once the user speaks a language, stay in that language for ALL remaining replies unless they switch again. NEVER switch back to English automatically.
6. Use 'Kundli', 'Graha', 'Rashi', 'Dasha', 'Upay' when speaking Hindi/Hinglish.
7. CRITICAL PHONETICS (Roman Script):
   - Use "Main" ONLY for "I" (e.g., "Main Swati hoon").
   - Use "Mein" ONLY for "In" (e.g., "Aapki rashi mein Shani hai"). 
   - NEVER use "Main" for "In", as it changes the pronunciation and meaning.

${previousTranscriptContext}
`.trim();

    const vapiConfig = {
      name: aiProfile.name,
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `${masterPrompt}\n\n${aiProfile.systemPromptAddition || ''}\n\n${vapiIntakeContext}`,
          },
        ],
      },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'hi', // Set to 'hi' for best Hindi/Hinglish/Indian English support
        keywords: [
          'Vaidik', 'Pandit', 'Kundli', 'Dosha', 'Graha', 'Rashi', 'Nakshatra', 'Shani', 'Mangal', 'Astro', 'Jyotish', 'Namaste', 'Pranam', 'Hindi',
          'Tarot', 'Arcana', 'Spread', 'MajorArcana', 'MinorArcana', 'Numerology', 'Radix', 'Bhagyank', 'LalKitab', 'Upay',
          ...Array.from(new Set([
            ...(aiProfile.name ? aiProfile.name.split(/[\s,.-]+/) : []), 
            ...(birthDetails.name ? birthDetails.name.split(/[\s,.-]+/) : []),
          ])).filter(k => k && k.length > 2 && /^[a-zA-Z0-9]+$/.test(k)) // Only single alphanumeric words > 2 chars
        ],
      },
      voice: {
        provider: finalProvider as any,
        voiceId: finalVoiceId,
      },
      silenceTimeoutSeconds: 3600,

      firstMessage: dynamicGreeting,
      maxDurationSeconds: session.maxDurationSeconds,
      metadata: {
        sessionId: channelName,
      },
      recordingEnabled: true,
      serverUrl: (() => {
        const configured = this.configService.get<string>('VAPI_WEBHOOK_URL');
        const backendUrl = this.configService.get<string>('BACKEND_URL') || this.configService.get<string>('APP_URL');
        if (configured) return configured;
        if (backendUrl) return `${backendUrl}/api/v1/ai-voice/webhook/vapi`;
       // return 'https://vaidik-6lpw.onrender.com/api/v1/ai-voice/webhook/vapi';
        return 'https://vaidik-6lpw.onrender.com/api/v1/ai-voice/webhook/vapi'
      })(),
      serverMessages: [
        'end-of-call-report', 
        'status-update', 
        'transcript',
        'speech-update',
        'user-interrupted'
      ],
    };

    session.voiceProvider = 'vapi';
    session.aiConfig = vapiConfig;
    await session.save();

    this.logger.log(`✅ AI Voice session prepared: ${channelName} with provider: vapi`);

    return {
      success: true,
      sessionId: channelName,
      orderId: session.orderId,
      astrologerId: session.astrologerId,
      astrologerImage: aiProfile.image,
      provider: 'vapi',
      vapiConfig,
    };
  }

  /**
   * Handle Webhooks from Vapi.ai (e.g., when call ends)
   */
  async handleVapiWebhook(payload: any): Promise<void> {
    const { message } = payload;
    const type = message?.type || payload?.type;
    const call = message?.call || payload?.call;

    // Log the incoming webhook type for debugging
    this.logger.log(`📥 Vapi.ai Webhook received: ${type}`);
    
    // FOR DEBUGGING: Log the first few fields of the payload
    if (message?.artifact || payload?.artifact) {
      this.logger.debug(`📦 Artifact found in webhook: ${JSON.stringify(message?.artifact || payload?.artifact)}`);
    }

    if (type === 'end-of-call-report' || type === 'call.ended') {
      const vapiCallId = call?.id;
      
      // SUPER ROBUST EXTRACTION: Check message root, message.artifact, and call root
      let recordingUrl = message?.recordingUrl || message?.artifact?.recordingUrl || call?.recordingUrl || payload?.artifact?.recordingUrl;
      let transcript = message?.transcript || message?.artifact?.transcript || call?.transcript || payload?.artifact?.transcript;
      
      // If transcript is an array (sometimes Vapi sends it as message list), join it
      if (Array.isArray(transcript)) {
        transcript = transcript.map((m: any) => `${m.role === 'assistant' ? 'AI' : 'User'}: ${m.content}`).join('\n');
      }

      const startedAt = message?.startedAt || call?.startedAt;
      const endedAt = message?.endedAt || call?.endedAt;
      const endedReason = message?.endedReason || call?.endedReason;
      
      // ✅ ULTRA ROBUST DURATION: Prioritize Vapi's internal call duration
      const durationFromPayload = 
        message?.durationSeconds || 
        message?.duration || 
        call?.duration || 
        message?.artifact?.durationSeconds || 
        payload?.artifact?.durationSeconds;

      if (!vapiCallId) {
        this.logger.warn(`⚠️ Vapi Webhook missing Call ID. Payload Type: ${type}`);
        return;
      }

      const session = await this.sessionModel.findOne({
        $or: [
          { vapiCallId: vapiCallId },
          { sessionId: call?.metadata?.sessionId },
          { sessionId: payload?.metadata?.sessionId }
        ]
      });

      // FALLBACK LOOKUP: If no session found by ID, look for the most recent session for this user/AI
      let targetSession = session;
      if (!targetSession) {
        this.logger.debug(`🔍 Attempting fallback lookup for Vapi Call ID: ${vapiCallId}`);
        // Look for any active or recently ended AI session in the last 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        targetSession = await this.sessionModel.findOne({
          isAi: true,
          status: { $in: ['active', 'ended'] },
          createdAt: { $gte: tenMinutesAgo }
        }).sort({ createdAt: -1 });

        if (targetSession) {
          this.logger.log(`✅ Fallback match found! Linked Vapi Call ${vapiCallId} to session ${targetSession.sessionId}`);
        }
      }

      if (targetSession) {
        // If the session is already ended (manually by user), we just attach the recording
        if (targetSession.status === 'ended') {
          this.logger.log(`📥 Attaching recording to already ended session: ${targetSession.sessionId}`);
          targetSession.vapiCallId = vapiCallId;
          if (recordingUrl) {
            targetSession.recordingUrl = recordingUrl;
            targetSession.hasRecording = true;
          }
          if (transcript) targetSession.transcript = transcript;
          
          let finalDuration = targetSession.duration || 0;
          if (!finalDuration && startedAt && endedAt) {
             finalDuration = Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
             targetSession.duration = finalDuration > 0 ? finalDuration : 0;
          } else if (!finalDuration && durationFromPayload) {
             finalDuration = durationFromPayload;
             targetSession.duration = finalDuration;
          }

          await targetSession.save();

          if (recordingUrl) {
            await this.callSessionService.updateRecordingAfterEnd(
              targetSession.sessionId,
              recordingUrl,
              '',
              finalDuration,
              transcript
            );
          }
          return;
        }

        // If not ended yet, end it now via the service
        const start = new Date(startedAt || targetSession.startTime);
        const end = new Date(endedAt || new Date());
        // Use payload duration if available
        let durationSeconds = 0;
        if (typeof durationFromPayload === 'number' && durationFromPayload >= 0) {
          durationSeconds = Math.floor(durationFromPayload);
        } else {
          durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
        }

        // ✅ FINAL SHIELD: If we already have a duration from 'vapi_end' signal, 
        // DO NOT let the webhook increase it by more than a small safety margin (e.g. 5s).
        // This prevents Vapi ghost sessions from inflating the bill.
        if (targetSession.duration > 0 && durationSeconds > targetSession.duration + 5) {
          this.logger.log(`🛡️ [AiVoiceService] Protecting session ${targetSession.sessionId} from ghost duration: Signal=${targetSession.duration}s, Webhook=${durationSeconds}s. Using Signal.`);
          durationSeconds = targetSession.duration;
        }
        
        if (isNaN(durationSeconds) || durationSeconds < 0) durationSeconds = 0;

        const endedBy = endedReason === 'customer-ended-call' ? 'user' : 'ai';
        const reason = endedReason || 'vapi_ended';

        this.logger.log(`💰 Ending AI Voice session from webhook: ${targetSession.sessionId}, Duration=${durationSeconds}s`);

        await this.callSessionService.endSession(
          targetSession.sessionId,
          endedBy,
          reason,
          recordingUrl,
          '',
          0,
          transcript,
          durationSeconds
        );

        if (recordingUrl) {
           await this.callSessionService.updateRecordingAfterEnd(
              targetSession.sessionId,
              recordingUrl,
              '',
              durationSeconds,
              transcript
            );
        }
      } else {
        this.logger.warn(`⚠️ No AI session found for Vapi Call ID: ${vapiCallId}. Metadata SessionID: ${call?.metadata?.sessionId}. Full Payload Sample: ${JSON.stringify(payload).substring(0, 500)}`);
      }
    }
  }
}
