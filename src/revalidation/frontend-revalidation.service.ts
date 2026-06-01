import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type FrontendRevalidateEvent =
  | { type: 'product.created' }
  | { type: 'product.updated'; id: string }
  | { type: 'product.deleted'; id: string }
  | { type: 'store.created' }
  | { type: 'store.updated'; id: string }
  | { type: 'store.deleted'; id: string }
  | { type: 'customer-review.created' }
  | { type: 'customer-review.updated' }
  | { type: 'customer-review.deleted' }
  | { type: 'product-review.created'; productId: string }
  | { type: 'product-review.updated'; productId: string }
  | { type: 'product-review.deleted'; productId: string };

@Injectable()
export class FrontendRevalidationService {
  private readonly logger = new Logger(FrontendRevalidationService.name);

  constructor(private readonly configService: ConfigService) {}

  async notify(event: FrontendRevalidateEvent): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const secret = this.configService.get<string>('REVALIDATE_SECRET');

    if (!frontendUrl || !secret) {
      return;
    }

    try {
      const response = await fetch(this.buildRevalidationUrl(frontendUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const message = await response.text().catch(() => '');

        this.logger.error(
          `Frontend revalidation failed for ${event.type}: ${response.status}${
            message ? ` ${message}` : ''
          }`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Frontend revalidation request failed for ${event.type}: ${this.formatError(
          error,
        )}`,
      );
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private buildRevalidationUrl(frontendUrl: string): string {
    return `${frontendUrl.replace(/\/+$/, '')}/api/revalidate`;
  }
}
