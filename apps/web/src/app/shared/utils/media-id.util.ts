import type { MediaAssetDto } from '../../core/models/domain.models';

/**
 * Prisma MediaAsset ids use cuid (`c…`), not UUID.
 * Reject missing / URL / filename / empty values before lesson create.
 */
const ENTITY_ID_PATTERN = /^c[a-z0-9]{24,32}$/i;

export function requireMediaAssetId(media: MediaAssetDto | null | undefined): string {
  if (!media) {
    throw new Error('Upload did not return a media record — aborting lesson creation');
  }

  const id = typeof media.id === 'string' ? media.id.trim() : '';
  if (!id) {
    throw new Error('Upload response missing media id — aborting lesson creation');
  }
  if (id.includes('/') || id.includes('\\') || id.includes('.')) {
    throw new Error(
      `contentMediaId looks like a path/URL/filename ("${id}"), expected a media entity id`,
    );
  }
  if (!ENTITY_ID_PATTERN.test(id)) {
    throw new Error(
      `contentMediaId "${id}" is not a valid media entity id — aborting lesson creation`,
    );
  }

  return id;
}
