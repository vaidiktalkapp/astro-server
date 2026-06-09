import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AstrologerAuthService } from '../src/auth/services/astrologer-auth.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const authService = app.get(AstrologerAuthService);
  
  try {
    console.log('Sending login OTP request...');
    const result = await authService.verifyLoginOtp({
      phoneNumber: '9873211086',
      countryCode: '91',
      otp: '987654', // The hardcoded demo OTP
      fcmToken: 'test-fcm-token',
      deviceId: 'test-device-id',
      deviceType: 'android',
      deviceName: 'Test Device'
    });
    console.log('Login Result:', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('Test Failed with Error:');
    console.error(err);
    if (err.stack) {
      console.error(err.stack);
    }
  }
  
  await app.close();
  process.exit(0);
}

bootstrap().catch(console.error);
