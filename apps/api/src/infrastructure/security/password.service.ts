import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  constructor(private readonly configService: ConfigService) {}

  hash(plain: string): Promise<string> {
    const rounds = this.configService.getOrThrow<number>('auth.bcryptSaltRounds');
    return bcrypt.hash(plain, rounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  generateRawToken(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  get minLength(): number {
    return this.configService.getOrThrow<number>('auth.passwordMinLength');
  }
}
