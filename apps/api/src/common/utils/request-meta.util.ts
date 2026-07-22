import type { FastifyRequest } from 'fastify';

export function extractClientMeta(request: FastifyRequest): {
  ipAddress?: string;
  userAgent?: string;
} {
  const forwarded = request.headers['x-forwarded-for'];
  const ipAddress =
    (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
    request.ip;

  const userAgentHeader = request.headers['user-agent'];
  const userAgent = Array.isArray(userAgentHeader)
    ? userAgentHeader[0]
    : userAgentHeader;

  return { ipAddress, userAgent };
}
