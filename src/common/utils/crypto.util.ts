import * as crypto from 'crypto';

export class CryptoUtil {
  /**
   * Generates a secure B2B API Key with prefix `dsp_live_` and returns both the raw key (shown once) and SHA-256 hash.
   */
  static generateApiKey(prefix = 'dsp_live_'): { rawKey: string; keyHash: string; maskedKey: string } {
    const randomBytes = crypto.randomBytes(24).toString('hex');
    const rawKey = `${prefix}${randomBytes}`;
    const keyHash = this.hashApiKey(rawKey);
    const maskedKey = `${rawKey.substring(0, 12)}...${rawKey.substring(rawKey.length - 4)}`;
    return { rawKey, keyHash, maskedKey };
  }

  /**
   * Hashes an API key with SHA-256 for secure database lookup
   */
  static hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Generates a secret for HMAC webhook signing
   */
  static generateWebhookSecret(): string {
    return `whsec_${crypto.randomBytes(24).toString('hex')}`;
  }

  /**
   * Signs a JSON payload with HMAC SHA-256 using the tenant's webhook secret
   */
  static signWebhookPayload(payload: string | object, secret: string): string {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verifies an incoming webhook signature securely
   */
  static verifyWebhookSignature(payload: string | object, secret: string, signature: string): boolean {
    const computedSignature = this.signWebhookPayload(payload, secret);
    try {
      return crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  /**
   * Generates a random alphanumeric order tracking token
   */
  static generateTrackingToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}
