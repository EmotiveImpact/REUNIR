/**
 * The browser safety rule for the app's own page: scripts only from this site, video and uploads only from this site and
 * Cloud Storage's signed links, and the two video players lessons may embed. It is sent report-only until staging shows
 * no violations (docs/SECURITY.md); vercel.json carries the same text for pages served by Vercel's CDN.
 */
export const CONTENT_SECURITY_POLICY = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob: https://storage.googleapis.com",
    "connect-src 'self' https://storage.googleapis.com",
    "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
].join('; ');
