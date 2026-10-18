import { timingSafeEqual } from 'node:crypto';

/** Query parameter that carries the per-launch token. */
export const TOKEN_PARAM = 't';

/**
 * Whether a request URL carries the token. The backend listens on loopback,
 * where every app on the device can reach it; only the WebView knows the token.
 */
export function hasToken(url: string | undefined, token: string): boolean {
  const given = new URL(url ?? '/', 'http://loopback').searchParams.get(
    TOKEN_PARAM,
  );
  if (given === null) {
    return false;
  }
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Appends the token to a URL that has no query yet. */
export function withToken(url: string, token: string): string {
  return `${url}?${TOKEN_PARAM}=${encodeURIComponent(token)}`;
}
