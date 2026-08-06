import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

/**
 * SimpleCacheService — Redis-backed with in-memory fallback.
 *
 * Uses the globally configured CacheModule (Redis in production,
 * in-memory in dev). This ensures refresh tokens survive server
 * restarts and work correctly across multiple instances.
 */
@Injectable()
export class SimpleCacheService {
  private readonly logger = new Logger(SimpleCacheService.name);

  // In-memory fallback (used only if Redis is unavailable)
  private fallbackCache = new Map<string, { value: any; expiry: number }>();
  private usingFallback = false;

  constructor(
    @Optional() @Inject(CACHE_MANAGER) private cacheManager: any,
  ) {
    if (!cacheManager) {
      this.usingFallback = true;
      this.logger.warn('⚠️  CACHE_MANAGER not available — using in-memory fallback. Tokens will be lost on restart.');
    } else {
      this.logger.log('✅ SimpleCacheService using Redis-backed CacheManager');
    }
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    try {
      if (this.cacheManager && !this.usingFallback) {
        // Redis path — TTL in milliseconds for cache-manager v5+
        await (this.cacheManager as any).set(key, value, ttlSeconds * 1000);
        this.logger.log(`📝 Redis SET: ${key} (TTL: ${ttlSeconds}s)`);
        return;
      }
    } catch (err) {
      this.logger.error(`❌ Redis SET failed for key "${key}", falling back to memory: ${err.message}`);
      this.usingFallback = true;
    }

    // In-memory fallback
    const expiry = Date.now() + ttlSeconds * 1000;
    this.fallbackCache.set(key, { value, expiry });
    setTimeout(() => this.fallbackCache.delete(key), ttlSeconds * 1000);
    this.logger.warn(`📝 Memory SET: ${key} (TTL: ${ttlSeconds}s)`);
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      if (this.cacheManager && !this.usingFallback) {
        const value = await (this.cacheManager as any).get(key);
        if (value !== null && value !== undefined) {
          this.logger.log(`✅ Redis HIT: ${key}`);
          return value as T;
        }
        this.logger.log(`🔍 Redis MISS: ${key}`);
        return undefined;
      }
    } catch (err) {
      this.logger.error(`❌ Redis GET failed for key "${key}", falling back to memory: ${err.message}`);
      this.usingFallback = true;
    }

    // In-memory fallback
    const item = this.fallbackCache.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiry) {
      this.fallbackCache.delete(key);
      return undefined;
    }
    return item.value as T;
  }

  async del(key: string): Promise<void> {
    try {
      if (this.cacheManager && !this.usingFallback) {
        await (this.cacheManager as any).del(key);
        this.logger.log(`🗑️ Redis DEL: ${key}`);
        return;
      }
    } catch (err) {
      this.logger.error(`❌ Redis DEL failed for key "${key}": ${err.message}`);
    }

    // In-memory fallback
    this.fallbackCache.delete(key);
    this.logger.warn(`🗑️ Memory DEL: ${key}`);
  }

  getAllKeys(): string[] {
    return Array.from(this.fallbackCache.keys());
  }
}

