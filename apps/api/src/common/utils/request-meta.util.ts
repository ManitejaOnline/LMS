import type { IncomingHttpHeaders } from 'http';

type ClientRequestLike = {
  headers: IncomingHttpHeaders;
  ip?: string;
  socket?: { remoteAddress?: string | null };
};

export function extractClientMeta(request: ClientRequestLike): {
  ipAddress?: string;
  userAgent?: string;
} {
  const forwarded = request.headers['x-forwarded-for'];
  const ipAddress =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
    request.ip ||
    request.socket?.remoteAddress ||
    undefined;

  const userAgentHeader = request.headers['user-agent'];
  const userAgent = Array.isArray(userAgentHeader)
    ? userAgentHeader[0]
    : userAgentHeader;

  return { ipAddress, userAgent };
}
