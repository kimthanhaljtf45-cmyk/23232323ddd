import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * INTEGRATION CRYPTO SERVICE
 * 
 * Encrypts/decrypts sensitive credentials for integrations.
 * Uses AES-256-CBC with a master key from environment.
 */

@Injectable()
export class IntegrationCryptoService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;

  constructor() {
    const masterKey = process.env.INTEGRATION_MASTER_KEY || 'dev-master-key-32-characters-ok';
    this.key = crypto.createHash('sha256').update(masterKey).digest();
  }

  encrypt(value: Record<string, any>): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);

    return JSON.stringify({
      iv: iv.toString('hex'),
      data: encrypted.toString('hex'),
    });
  }

  decrypt(payload: string): Record<string, any> {
    try {
      const parsed = JSON.parse(payload);
      const iv = Buffer.from(parsed.iv, 'hex');
      const encryptedText = Buffer.from(parsed.data, 'hex');

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      const decrypted = Buffer.concat([
        decipher.update(encryptedText),
        decipher.final(),
      ]);

      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      console.error('[IntegrationCrypto] Decrypt error:', error);
      return {};
    }
  }
}
