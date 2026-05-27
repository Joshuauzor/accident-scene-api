import {
  createHash,
  createCipheriv,
  randomBytes,
  createDecipheriv,
  scryptSync,
} from 'crypto';

export interface IEncryption {
  encrypt: (str_to_encrypt: string) => string | null;
  decrypt: (str_to_decrypt: string) => string | null;
}

export class AesEncryption implements IEncryption {
  private private_key: string;
  private static STATE_SECRET =
    process.env.OAUTH_STATE_SECRET || 'default-secret-change-me';

  constructor(private_key: string) {
    this.private_key = private_key;
  }

  encrypt(str_to_encrypt: string): string {
    try {
      // 1. Generate random IV for each encryption
      const iv = randomBytes(16);

      // 2. Generate random salt for key derivation
      const salt = randomBytes(32);

      // 3. Derive key using salt (not IV!)
      const key = scryptSync(this.private_key, salt, 32, { N: 16384 }); // Or use pbkdf2Sync

      // 4. Encrypt
      const cipher = createCipheriv('aes-256-gcm', key, iv);

      // 5. Encrypt the data
      let encrypted = cipher.update(str_to_encrypt, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // 6. Get auth tag (GCM provides built-in authentication)
      const auth_tag = cipher.getAuthTag();

      // 7. Combine: salt + iv + authTag + ciphertext
      const combined = Buffer.concat([
        salt,
        iv,
        auth_tag,
        Buffer.from(encrypted, 'base64'),
      ]);

      return combined.toString('base64');
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Encryption failed: ' + error.message);
    }
  }

  decrypt(encrypted_data: string): string {
    try {
      // 1. Decode the combined data
      const combined = Buffer.from(encrypted_data, 'base64');

      // 2. Extract components
      const salt = combined.subarray(0, 32);
      const iv = combined.subarray(32, 48);
      const auth_tag = combined.subarray(48, 64);
      const ciphertext = combined.subarray(64);

      // 3. Derive key using the same salt
      const key = scryptSync(this.private_key, salt, 32, { N: 16384 });

      // 4. Decrypt
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(auth_tag);

      let decrypted = decipher.update(ciphertext, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  generate_state(provider: string, prefix: string): string {
    const random_token = randomBytes(16).toString('hex');

    const hash = createHash('sha256')
      .update(`${random_token}${provider}${AesEncryption.STATE_SECRET}`)
      .digest('hex');

    return `${prefix}_${random_token}_${hash}`;
  }

  verify_state(state: string, provider: string): boolean {
    const parts = state.split('_');
    if (parts.length !== 3) return false;

    const [prefix, random_token, original_hash] = parts;
    if (prefix !== provider.substring(0, 2)) return false;

    const new_hash = createHash('sha256')
      .update(`${random_token}${provider}${AesEncryption.STATE_SECRET}`)
      .digest('hex');

    return new_hash === original_hash;
  }
}
