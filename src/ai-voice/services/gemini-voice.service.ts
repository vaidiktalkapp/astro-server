// src/ai-voice/services/gemini-voice.service.ts

import { Injectable, Logger } from '@nestjs/common';
import WebSocket from 'ws';

interface GeminiSession {
  ws: WebSocket;
  sessionId: string;
  userSocketId: string;
  isReady: boolean;
  audioQueue: string[]; // base64 chunks queued before setup completes
  transcript: { role: string; text: string }[]; // Captured conversation
}

@Injectable()
export class GeminiVoiceService {
  private readonly logger = new Logger(GeminiVoiceService.name);

  // sessionId → GeminiSession
  private sessions = new Map<string, GeminiSession>();

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API (called from CallGateway)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Open a server-side WebSocket to Gemini Live for a given call session.
   * `onAudio`   → called whenever Gemini sends audio back (base64 PCM)
   * `onClose`   → called when Gemini closes the connection
   */
  async openSession(
    sessionId: string,
    userSocketId: string,
    aiConfig: {
      apiKey: string;
      systemInstruction: string;
      tools: any[];
      firstMessage: string;
      maxDurationSeconds: number;
      voiceName?: string;
    },
    onAudio: (base64: string) => void,
    onClose: () => void,
    onReady?: () => void,  // Called when Gemini setup_complete is received (AI is truly ready)
  ): Promise<void> {
    if (this.sessions.has(sessionId)) {
      this.logger.warn(`[Gemini] Session ${sessionId} already open`);
      return;
    }

    const url =
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta` +
      `.GenerativeService.BidiGenerateContent?key=${aiConfig.apiKey}`;

    this.logger.log(`[Gemini] Opening server-side WS for session ${sessionId}`);

    const ws = new WebSocket(url);
    const session: GeminiSession = {
      ws,
      sessionId,
      userSocketId,
      isReady: false,
      audioQueue: [],
      transcript: [],
    };
    this.sessions.set(sessionId, session);

    ws.on('open', () => {
      this.logger.log(`[Gemini] WS open for ${sessionId}`);

      // Send setup message
      const setupMsg = {
        setup: {
          model: 'models/gemini-3.1-flash-live-preview',
          generation_config: {
            response_modalities: ['AUDIO'],
            speech_config: {
              voice_config: {
                prebuilt_voice_config: { voice_name: aiConfig.voiceName || 'Aoede' },
              },
            },
          },
          system_instruction: {
            parts: [{
              text: `You are a warm, expert Indian Vedic astrologer (Vaidik Pandit) on a live voice call.\n\n` +
                `LANGUAGE INTELLIGENCE (CRITICAL):\n` +
                `- LISTEN to the language the user is actually SPEAKING.\n` +
                `- AUTOMATICALLY respond in whatever language the user speaks — Hindi, English, Hinglish, or any mix.\n` +
                `- If the user speaks Hindi → reply in simple conversational Hindi (bolchal ki bhasha).\n` +
                `- If the user speaks English → reply in English.\n` +
                `- If the user speaks Hinglish (Hindi + English mixed) → also reply in Hinglish naturally.\n` +
                `- NEVER refuse to answer because of language. NEVER ask the user to change their language.\n` +
                `- NEVER switch to a different language unless the user switches first.\n\n` +
                `VOICE STYLE:\n` +
                `- Speak naturally and conversationally, like a real human pandit on a phone call.\n` +
                `- Keep sentences short and clear. No long monologues.\n` +
                `- Sound warm, confident, and spiritually authoritative.\n` +
                `- Speak at a natural conversational pace.\n\n` +
                `${aiConfig.systemInstruction}`
            }],
          },
          tools: aiConfig.tools?.length > 0 ? aiConfig.tools : undefined,
        },
      };
      ws.send(JSON.stringify(setupMsg));
    });

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.setup_complete || msg.setupComplete) {
          this.logger.log(`[Gemini] Setup complete for ${sessionId}`);
          session.isReady = true;

          // Flush queued audio
          for (const chunk of session.audioQueue) {
            this.sendAudioChunk(sessionId, chunk);
          }
          session.audioQueue = [];

          // Send first message as text turn
          if (aiConfig.firstMessage) {
            ws.send(
              JSON.stringify({
                client_content: {
                  turns: [{ role: 'user', parts: [{ text: aiConfig.firstMessage }] }],
                  turn_complete: true,
                },
              }),
            );
          }

          // ✅ Notify gateway that Gemini is truly ready — timer starts NOW
          onReady?.();
          return;
        }

        const serverContent = msg.server_content || msg.serverContent;
        if (serverContent?.model_turn?.parts || serverContent?.modelTurn?.parts) {
          const parts = serverContent.model_turn?.parts || serverContent.modelTurn.parts;
          for (const part of parts) {
            // Capture Audio
            const inlineData = part.inline_data || part.inlineData;
            if (inlineData?.data && (inlineData.mime_type || inlineData.mimeType)?.includes('audio')) {
              onAudio(inlineData.data);
            }
            // Capture Text (Transcript)
            if (part.text) {
              session.transcript.push({ role: 'assistant', text: part.text });
            }
          }
        }

        if (serverContent?.interrupted) {
          this.logger.log(`[Gemini] Interrupted for ${sessionId}`);
        }

      } catch (e) {
        this.logger.error(`[Gemini] Parse error for ${sessionId}: ${e.message}`);
      }
    });

    ws.on('close', (code, reason) => {
      this.logger.log(`[Gemini] WS closed for ${sessionId}: ${code} ${reason}`);
      this.sessions.delete(sessionId);
      onClose();
    });

    ws.on('error', (err) => {
      this.logger.error(`[Gemini] WS error for ${sessionId}: ${err.message}`);
    });
  }

  /**
   * Forward a base64 PCM audio chunk from the browser to Gemini.
   */
  sendAudioChunk(sessionId: string, base64Audio: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (!session.isReady) {
      session.audioQueue.push(base64Audio);
      return;
    }

    if (session.ws.readyState !== WebSocket.OPEN) return;

    session.ws.send(
      JSON.stringify({
        realtime_input: {
          audio: {
            data: base64Audio,
            mime_type: 'audio/pcm;rate=16000',
          },
        },
      }),
    );
  }

  /**
   * Close the Gemini session cleanly.
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.logger.log(`[Gemini] Closing session ${sessionId}`);
    if (
      session.ws.readyState === WebSocket.OPEN ||
      session.ws.readyState === WebSocket.CONNECTING
    ) {
      session.ws.close();
    }
    this.sessions.delete(sessionId);
  }

  getTranscript(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';
    return session.transcript
      .map((t) => `${t.role === 'user' ? 'User' : 'AI'}: ${t.text}`)
      .join('\n');
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROMPT / TOOL HELPERS (keep your existing ones below)
  // ─────────────────────────────────────────────────────────────────────────

  getCleanVoicePrompt(masterPrompt: string): string {
    return masterPrompt
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  getGeminiTools(): any[] {
    return [
      {
        functionDeclarations: [
          {
            name: 'getBirthChart',
            description: 'Calculate the Vedic birth chart (Kundli) for a person based on their birth details.',
            parameters: {
              type: 'OBJECT',
              properties: {
                dateOfBirth: { type: 'STRING', description: 'Date of birth in YYYY-MM-DD format' },
                timeOfBirth: { type: 'STRING', description: 'Time of birth in HH:MM format (24-hour)' },
                placeOfBirth: { type: 'STRING', description: 'Place of birth (city, country)' },
              },
              required: ['dateOfBirth', 'placeOfBirth'],
            },
          },
          {
            name: 'getDashaPeriods',
            description: 'Get the Vimshottari Dasha periods for a person.',
            parameters: {
              type: 'OBJECT',
              properties: {
                dateOfBirth: { type: 'STRING', description: 'Date of birth in YYYY-MM-DD format' },
                timeOfBirth: { type: 'STRING', description: 'Time of birth in HH:MM format' },
                placeOfBirth: { type: 'STRING', description: 'Place of birth' },
              },
              required: ['dateOfBirth', 'placeOfBirth'],
            },
          },
          {
            name: 'getPanchang',
            description: 'Get today\'s Panchang (Hindu almanac) for a specific location.',
            parameters: {
              type: 'OBJECT',
              properties: {
                date: { type: 'STRING', description: 'Date in YYYY-MM-DD format' },
                placeOfBirth: { type: 'STRING', description: 'Location for Panchang calculation' },
              },
              required: ['date', 'placeOfBirth'],
            },
          },
        ],
      },
    ];
  }
}