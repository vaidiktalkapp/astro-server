import { Injectable } from '@nestjs/common';

interface StoredOTP {
  otp: string;
  phoneNumber: string;
  countryCode: string;
  expiresAt: number;
  attempts: number;
}

@Injectable()
export class OtpStorageService {
  private otpStore = new Map<string, StoredOTP>();
  private rateLimitStore = new Map<string, { attempts: number; lastAttempt: number }>();

  private createKey(phoneNumber: string, countryCode: string): string {
    return `${countryCode}${phoneNumber}`;
  }

  // Store OTP
  storeOTP(phoneNumber: string, countryCode: string, otp: string, ttlMinutes: number = 10): void {
    const key = this.createKey(phoneNumber, countryCode);
    const expiresAt = Date.now() + (ttlMinutes * 60 * 1000);
    
    this.otpStore.set(key, {
      otp,
      phoneNumber,
      countryCode,
      expiresAt,
      attempts: 0
    });

    console.log(`✅ OTP stored for key: ${key}, OTP: ${otp}, Expires: ${new Date(expiresAt)}`);
    
    // Auto cleanup after expiry
    setTimeout(() => {
      this.otpStore.delete(key);
      console.log(`🗑️ Auto-cleaned expired OTP for key: ${key}`);
    }, ttlMinutes * 60 * 1000);
  }

  // Get Stored OTP metadata
  getStoredOTP(phoneNumber: string, countryCode: string): StoredOTP | undefined {
    const key = this.createKey(phoneNumber, countryCode);
    return this.otpStore.get(key);
  }

  // Retrieve and validate OTP
  validateOTP(phoneNumber: string, countryCode: string, enteredOTP: string): {
    valid: boolean;
    message: string;
  } {
    const key = this.createKey(phoneNumber, countryCode);
    const stored = this.otpStore.get(key);

    console.log(`🔍 Validating OTP for key: ${key}`);
    console.log(`🔍 Stored data:`, stored);
    console.log(`🔍 Entered OTP: ${enteredOTP}`);
    console.log(`🔍 All stored keys:`, Array.from(this.otpStore.keys()));

    if (!stored) {
      return {
        valid: false,
        message: 'OTP expired or not found. Please request a new OTP.'
      };
    }

    // Check expiry
    if (Date.now() > stored.expiresAt) {
      this.otpStore.delete(key);
      return {
        valid: false,
        message: 'OTP expired. Please request a new OTP.'
      };
    }

    // Check attempts
    if (stored.attempts >= 3) {
      this.otpStore.delete(key);
      return {
        valid: false,
        message: 'Too many invalid attempts. Please request a new OTP.'
      };
    }

    // Check OTP match
    if (stored.otp !== enteredOTP) {
      stored.attempts++;
      return {
        valid: false,
        message: 'Invalid OTP. Please check and try again.'
      };
    }

    // Success - remove OTP
    this.deleteOTP(phoneNumber, countryCode);
    console.log(`✅ OTP validated successfully for key: ${key}`);
    
    return {
      valid: true,
      message: 'OTP verified successfully'
    };
  }

  // Check rate limiting
  checkRateLimit(phoneNumber: string, countryCode: string): {
    allowed: boolean;
    message: string;
  } {
    const key = this.createKey(phoneNumber, countryCode);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    const rateLimit = this.rateLimitStore.get(key);

    if (!rateLimit) {
      this.rateLimitStore.set(key, { attempts: 1, lastAttempt: now });
      return { allowed: true, message: 'OK' };
    }

    // Reset if more than 1 hour passed
    if (now - rateLimit.lastAttempt > oneHour) {
      this.rateLimitStore.set(key, { attempts: 1, lastAttempt: now });
      return { allowed: true, message: 'OK' };
    }

    // Check limit
    if (rateLimit.attempts >= 3) {
      return {
        allowed: false,
        message: 'Too many OTP requests. Please try again after 1 hour.'
      };
    }

    // Increment attempts
    rateLimit.attempts++;
    rateLimit.lastAttempt = now;
    
    return { allowed: true, message: 'OK' };
  }

  // Clear rate limit on successful verification
  clearRateLimit(phoneNumber: string, countryCode: string): void {
    const key = this.createKey(phoneNumber, countryCode);
    this.rateLimitStore.delete(key);
  }

  deleteOTP(phoneNumber: string, countryCode: string): void {
    const key = this.createKey(phoneNumber, countryCode);
    this.otpStore.delete(key);
  }

  // Debug method
  getStoredOTPs(): any {
    return {
      otps: Array.from(this.otpStore.entries()),
      rateLimits: Array.from(this.rateLimitStore.entries())
    };
  }
}
