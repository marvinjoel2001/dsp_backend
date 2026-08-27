import { CryptoUtil } from '../crypto.util';

describe('CryptoUtil', () => {
  it('should generate a valid API key with prefix, keyHash and maskedKey', () => {
    const result = CryptoUtil.generateApiKey('dsp_live_');
    expect(result.rawKey).toMatch(/^dsp_live_[a-f0-9]{48}$/);
    expect(result.keyHash).toHaveLength(64);
    expect(result.maskedKey).toContain('...');
    expect(result.maskedKey.startsWith('dsp_live_')).toBe(true);
    expect(CryptoUtil.hashApiKey(result.rawKey)).toEqual(result.keyHash);
  });

  it('should generate a webhook secret with whsec_ prefix', () => {
    const secret = CryptoUtil.generateWebhookSecret();
    expect(secret.startsWith('whsec_')).toBe(true);
    expect(secret.length).toBeGreaterThan(20);
  });

  it('should sign and verify webhook payloads accurately', () => {
    const payload = { event: 'order.created', data: { id: 'ord_123' } };
    const secret = 'whsec_test_secret_12345';

    const signature = CryptoUtil.signWebhookPayload(payload, secret);
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');

    const isValid = CryptoUtil.verifyWebhookSignature(payload, secret, signature);
    expect(isValid).toBe(true);

    const isInvalid = CryptoUtil.verifyWebhookSignature(payload, secret, 'invalid_signature_hex');
    expect(isInvalid).toBe(false);
  });

  it('should generate a 32-character hex tracking token', () => {
    const token = CryptoUtil.generateTrackingToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });
});
