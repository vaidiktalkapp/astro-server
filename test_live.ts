import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AiAstrologyEngineService } from './src/ai-astrologers/services/ai-astrology-engine.service';

async function bootstrap() {
  console.log('Initializing app context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const engineService = app.get(AiAstrologyEngineService);

  const astrologerProfile = {
      name: 'Vaidik AI',
      expertise: 'Numerology',
      personalityType: 'Empathetic',
      focusArea: 'Career, Relationships, health, and personal growth.',
      tone: 'calm, confident, and compassionate'
  };

  const userBirthDetails = {
      name: 'Kamaldeep kaur',
      dateOfBirth: '2000-01-01',
      timeOfBirth: '12:00',
      placeOfBirth: 'India',
  };

  const messages = [
      "Husband k sath bht ldai chl rhi hai vo foreign spain mai rehte hai baat bhi band k kya hum alg ho jayenge??"
  ];

  let history: any[] = [];

  for (const msg of messages) {
      console.log("\n--------------------------------------------------");
      console.log(`👤 USER: ${msg}`);
      console.log("--------------------------------------------------");
      console.log("⏳ Generating response...");
      
      const response = await engineService.generateResponse(msg, astrologerProfile, userBirthDetails, history, 'English');
      
      console.log("\n🤖 AI ASTROLOGER:");
      console.log(response);

      history.push({ role: 'user', content: msg });
      history.push({ role: 'assistant', content: response });
  }

  await app.close();
}
bootstrap();
