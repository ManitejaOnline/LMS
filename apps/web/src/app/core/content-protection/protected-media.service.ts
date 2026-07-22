import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { TokenStorageService } from '../auth/token-storage.service';
import type { MediaAssetDto } from '../models/domain.models';

/**
 * Builds authenticated stream URLs for learning content.
 * Avoids exposing raw public /uploads links in the player DOM.
 */
@Injectable({ providedIn: 'root' })
export class ProtectedMediaService {
  private readonly tokens = inject(TokenStorageService);

  /**
   * Authenticated stream URL suitable for <video src> and pdf.js.
   * Token is passed as query param because media elements cannot set headers.
   */
  learningStreamUrl(media: MediaAssetDto | null | undefined): string | null {
    if (!media?.id) return null;
    const token = this.tokens.accessToken();
    if (!token) return null;
    const base = `${environment.apiBaseUrl}/media/${media.id}/stream`;
    return `${base}?access_token=${encodeURIComponent(token)}`;
  }
}
