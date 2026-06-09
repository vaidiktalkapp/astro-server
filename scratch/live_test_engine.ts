import { AiAstrologyEngineService } from '../src/ai-astrologers/services/ai-astrology-engine.service';
import { AstronomyService } from '../src/ai-astrologers/services/astronomy.service';
import { ConfigService } from '@nestjs/config';

// Mocking dependencies
const mockConfigService = {
    get: (key: string) => {
        if (key === 'OPENAI_API_KEY') return process.env.OPENAI_API_KEY;
        return null;
    }
} as any;

const mockAstronomyService = {
    geocodePlaceOfBirth: async () => ({ lat: 18.5204, lon: 73.8567 }),
    getBirthChart: async (data: any) => {
        // This will call the actual Python bridge
        const { execSync } = require('child_process');
        const scriptPath = 'd:\\vaidiktalkAI\\vaidik-server-main\\src\\ai-astrologers\\scripts\\astronomy_bridge.py';
        const result = execSync(`python ${scriptPath} '${JSON.stringify({ action: 'all', ...data })}'`).toString();
        return JSON.parse(result).data;
    },
    calculateAllData: async (date: string, time: string, lat: string, lon: string, tzone: number) => {
        const { execSync } = require('child_process');
        const scriptPath = 'd:\\vaidiktalkAI\\vaidik-server-main\\src\\ai-astrologers\\scripts\\astronomy_bridge.py';
        const result = execSync(`python ${scriptPath} '${JSON.stringify({ action: 'all', date, time, lat, lon, tzone })}'`).toString();
        return JSON.parse(result).data;
    }
} as any;

const mockHoroscopeService = {} as any;
const mockLalKitabSettingsService = {} as any;
const mockAstrologyContentService = {
    getMoonSignByName: async () => null
} as any;

const engine = new AiAstrologyEngineService(
    mockAstronomyService, 
    mockConfigService, 
    mockHoroscopeService, 
    mockLalKitabSettingsService, 
    mockAstrologyContentService
);

async function runTest() {
    console.log("🚀 Starting Live Test for Vishal...");
    
    const response = await engine.generateResponse(
        "meri love life ke baare mai batao kuch or mera bhagya kaisa rhega",
        {
            name: "Vaidik AI",
            expertise: "Vedic",
            tone: "Spiritual and Empathetic"
        },
        {
            name: "Vishal",
            dateOfBirth: "10-10-2000",
            timeOfBirth: "15:30",
            placeOfBirth: "Pune"
        },
        [],
        'Hindi'
    );

    console.log("\n--- FINAL AI RESPONSE ---\n");
    console.log(response);
    console.log("\n-------------------------\n");
}

runTest().catch(console.error);
