import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import { OtpStorageService } from './otp-storage.service';
const FormData = require('form-data');

// Custom TooManyRequestsException
export class TooManyRequestsException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  // 🧪 Test ACCOUNT CREDENTIALS
  private readonly DEMO_PHONES = ['9873211086', '7878787878'];
  private readonly DEMO_OTP = '987654';

  constructor(
    private configService: ConfigService,
    private otpStorage: OtpStorageService,
  ) {
    this.logger.log('🔐 OTP Service initialized with Meta WhatsApp API');
  }

  // Normalize phone number to strip formatting and country codes
  normalizePhoneNumber(phoneNumber: string, countryCode: string): string {
    if (!phoneNumber) return '';
    let cleanPhone = phoneNumber.replace(/[^\d+]/g, '');

    if (cleanPhone.startsWith(`+${countryCode}`)) {
      cleanPhone = cleanPhone.substring(countryCode.length + 1);
    } else if (cleanPhone.startsWith(countryCode) && cleanPhone.length > 10 && countryCode !== '1') {
      cleanPhone = cleanPhone.substring(countryCode.length);
    } else if (cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.substring(1);
    }

    return cleanPhone;
  }

  // Generate 6-digit OTP
  public generateOTP(): string { // Changed to public to allow access from tests/other services if needed
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Hash phone number with country code for privacy
  hashPhoneNumber(phoneNumber: string, countryCode: string): string {
    const cleanPhone = this.normalizePhoneNumber(phoneNumber, countryCode);
    const fullNumber = `${countryCode}${cleanPhone}`;
    return crypto.createHash('sha256').update(fullNumber).digest('hex');
  }

  // Validate phone number based on country code
  private validatePhoneNumber(phoneNumber: string, countryCode: string): boolean {
    const cleanPhone = this.normalizePhoneNumber(phoneNumber, countryCode);

    const validationRules = {
      '91': /^[6-9]\d{9}$/, // India: 10 digits starting with 6-9
      '1': /^[2-9]\d{9}$/, // US/Canada: 10 digits
    };

    const rule = validationRules[countryCode];
    if (!rule) {
      return /^[0-9]{7,15}$/.test(cleanPhone);
    }

    return rule.test(cleanPhone);
  }

  // Helper to get Message Central Token
  private async getMessageCentralToken(): Promise<string> {
    const customerId = this.configService.get<string>('MESSAGE_CENTRAL_CUSTOMER_ID');
    const key = this.configService.get<string>('MESSAGE_CENTRAL_KEY');
    if (!customerId || !key) {
      throw new Error('Missing Message Central credentials in environment variables');
    }
    const authUrl = `https://cpaas.messagecentral.com/auth/v1/authentication/token?country=IN&customerId=${customerId}&key=${key}&scope=NEW`;
    const res = await axios.get(authUrl);
    return res.data.token;
  }

  // Send OTP via Message Central API
  async sendOTP(
    phoneNumber: string,
    countryCode: string
  ): Promise<{ success: boolean; message: string; otp?: string }> {
    try {
      const cleanPhone = this.normalizePhoneNumber(phoneNumber, countryCode);

      // 🧪 1. CHECK FOR DEMO ACCOUNT BYPASS
      if (this.DEMO_PHONES.includes(cleanPhone)) {
        this.logger.log(`🧪 Demo Account Login Attempt: +${countryCode}${cleanPhone}`);
        return {
          success: true,
          message: 'OTP sent successfully (Demo Account)',
          ...(this.configService.get('NODE_ENV') === 'development' && { otp: this.DEMO_OTP })
        };
      }

      // Validate phone number
      if (!this.validatePhoneNumber(cleanPhone, countryCode)) {
        throw new BadRequestException(
          `Invalid phone number format for country code +${countryCode}`
        );
      }

      // Check rate limiting
      const rateCheck = this.otpStorage.checkRateLimit(cleanPhone, countryCode);
      if (!rateCheck.allowed) {
        throw new TooManyRequestsException(rateCheck.message);
      }

      this.logger.log(`📞 Requesting OTP for +${countryCode}${cleanPhone} via Message Central API`);

      // Request OTP from Message Central
      const token = await this.getMessageCentralToken();
      const sendUrl = `https://cpaas.messagecentral.com/verification/v3/send?countryCode=${countryCode}&flowType=WHATSAPP&mobileNumber=${cleanPhone}&otpLength=6`;
      
      const res = await axios.post(sendUrl, {}, {
        headers: { 'authToken': token },
        timeout: 30000,
      });

      if (res.data.responseCode === 200 && res.data.data && res.data.data.verificationId) {
        const verificationId = res.data.data.verificationId;
        this.logger.log(`✅ Message Central API Success. Verification ID: ${verificationId}`);
        
        // Store verificationId instead of OTP
        this.otpStorage.storeOTP(cleanPhone, countryCode, verificationId, 10); // 10 minutes

        return {
          success: true,
          message: 'OTP sent to your phone successfully via Message Central'
        };
      } else if (res.data.responseCode === 506) {
        throw new TooManyRequestsException('OTP already sent recently. Please wait before requesting again.');
      } else {
        this.logger.error('❌ Message Central API Error:', res.data);
        throw new BadRequestException(`Failed to send OTP: ${res.data.message || 'Unknown error'}`);
      }

    } catch (error) {
      this.logger.error('❌ OTP Send Error:', error);

      if (error instanceof TooManyRequestsException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to send OTP. Please try again.');
    }
  }

  // Verify OTP via Message Central API
  async verifyOTP(
    phoneNumber: string,
    countryCode: string,
    enteredOTP: string
  ): Promise<boolean> {
    try {
      const cleanPhone = this.normalizePhoneNumber(phoneNumber, countryCode);
      this.logger.log(`🔍 Verifying OTP for +${countryCode}${cleanPhone}: ${enteredOTP}`);

      // 🧪 2. CHECK FOR DEMO ACCOUNT BYPASS
      if (this.DEMO_PHONES.includes(cleanPhone)) {
        if (enteredOTP === this.DEMO_OTP) {
          this.logger.log(`✅ Demo OTP verified successfully for +${countryCode}${cleanPhone}`);
          return true;
        } else {
          this.logger.warn(`❌ Invalid Demo OTP attempt for +${countryCode}${cleanPhone}`);
          throw new BadRequestException(`Invalid Demo OTP. Please use ${this.DEMO_OTP}.`);
        }
      }

      // Retrieve stored verificationId
      const stored = this.otpStorage.getStoredOTP(cleanPhone, countryCode);

      if (!stored) {
        throw new BadRequestException('OTP expired or not found. Please request a new OTP.');
      }

      // Check local expiry
      if (Date.now() > stored.expiresAt) {
        this.otpStorage.deleteOTP(cleanPhone, countryCode);
        throw new BadRequestException('OTP expired. Please request a new OTP.');
      }

      // Check max attempts locally before hitting API
      if (stored.attempts >= 3) {
        this.otpStorage.deleteOTP(cleanPhone, countryCode);
        throw new BadRequestException('Too many invalid attempts. Please request a new OTP.');
      }

      const verificationId = stored.otp; // We stored verificationId in the 'otp' field
      const customerId = this.configService.get<string>('MESSAGE_CENTRAL_CUSTOMER_ID');
      const token = await this.getMessageCentralToken();

      const valUrl = `https://cpaas.messagecentral.com/verification/v3/validateOtp?countryCode=${countryCode}&mobileNumber=${cleanPhone}&verificationId=${verificationId}&customerId=${customerId}&code=${enteredOTP}`;
      
      const res = await axios.get(valUrl, {
        headers: { 'authToken': token },
        timeout: 30000,
      });

      if (res.data.responseCode === 200) {
        // Success
        this.otpStorage.clearRateLimit(cleanPhone, countryCode);
        this.otpStorage.deleteOTP(cleanPhone, countryCode);
        this.logger.log(`✅ OTP verified successfully via Message Central for +${countryCode}${cleanPhone}`);
        return true;
      } else {
        // Failed
        stored.attempts++;
        this.logger.warn(`❌ Invalid OTP attempt via Message Central for +${countryCode}${cleanPhone}: ${res.data.message}`);
        
        if (stored.attempts >= 3) {
          this.otpStorage.deleteOTP(cleanPhone, countryCode);
          throw new BadRequestException('Too many invalid attempts. Please request a new OTP.');
        }
        
        throw new BadRequestException(res.data.message === 'WRONG_OTP_PROVIDED' ? 'Invalid OTP. Please check and try again.' : res.data.message || 'Invalid OTP');
      }

    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('❌ OTP Verification Error:', error);
      throw new BadRequestException('OTP verification failed. Please try again.');
    }
  }

  // Resend OTP
  async resendOTP(
    phoneNumber: string,
    countryCode: string
  ): Promise<{ success: boolean; message: string; otp?: string }> {
    this.logger.log(`🔄 Resending OTP for +${countryCode}${phoneNumber}`);
    return await this.sendOTP(phoneNumber, countryCode);
  }

  // Test Message Central API Connection
  async testWhatsAppConnection(testPhoneNumber?: string): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const phoneNumber = testPhoneNumber || '9999999999';
      const countryCode = '91';

      this.logger.log(`🧪 Testing Message Central API with ${countryCode}${phoneNumber}`);

      const result = await this.sendOTP(phoneNumber, countryCode);

      return {
        success: result.success,
        message: result.message,
        details: {
          testNumber: `+${countryCode}${phoneNumber}`,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Message Central API test failed',
        details: {
          error: error.message
        }
      };
    }
  }

  // Get detailed debug info
  getDebugInfo() {
    return {
      nodeEnv: this.configService.get('NODE_ENV'),
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  }
}
