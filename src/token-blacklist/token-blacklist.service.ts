import { Injectable } from '@nestjs/common';

@Injectable()
export class TokenBlacklistService {
  // Map<token, expiresAtMs>
  private readonly blacklist = new Map<string, number>();

  add(token: string, expSec: number): void {
    this.blacklist.set(token, expSec * 1000);
    this.purgeExpired();
  }

  isBlacklisted(token: string): boolean {
    const expiresAt = this.blacklist.get(token);

    if (expiresAt === undefined) {
      return false;
    }

    if (Date.now() >= expiresAt) {
      this.blacklist.delete(token);
      return false;
    }

    return true;
  }

  private purgeExpired(): void {
    const now = Date.now();

    for (const [token, expiresAt] of this.blacklist) {
      if (now >= expiresAt) {
        this.blacklist.delete(token);
      }
    }
  }
}
