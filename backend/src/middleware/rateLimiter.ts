import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// In-memory rate limiting map: key -> RateLimitRecord
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Clean up expired rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // every 1 minute

/**
 * Rate limiter middleware for Forgot Password endpoint.
 * Limits to 5 requests per 15 minutes per IP + email.
 */
export function forgotPasswordRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
  const email = (req.body?.email || '').trim().toLowerCase();
  const key = `forgot-pwd:${ip}:${email}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 5;

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= maxRequests) {
    const waitMins = Math.ceil((record.resetTime - now) / 60000);
    return res.status(429).json({
      success: false,
      error: `Too many password reset requests. Please wait ${waitMins} minute(s) before trying again.`
    });
  }

  record.count += 1;
  return next();
}

/**
 * Duplicate SOS session tracker to prevent bursts for the same emergency session
 */
interface SessionAlertRecord {
  contactSentMap: Map<string, number>; // contactId/email -> timestamp
  firstSentAt: number;
}

const sessionNotificationCache = new Map<string, SessionAlertRecord>();

// Clean up sessions older than 2 hours
setInterval(() => {
  const now = Date.now();
  const twoHours = 2 * 60 * 60 * 1000;
  for (const [sessionId, rec] of sessionNotificationCache.entries()) {
    if (now - rec.firstSentAt > twoHours) {
      sessionNotificationCache.delete(sessionId);
    }
  }
}, 10 * 60 * 1000);

export function getSessionTracker(sessionId: string) {
  let session = sessionNotificationCache.get(sessionId);
  if (!session) {
    session = {
      contactSentMap: new Map<string, number>(),
      firstSentAt: Date.now()
    };
    sessionNotificationCache.set(sessionId, session);
  }
  return session;
}

export function shouldSendToContact(sessionId: string, contactIdentifier: string, throttleIntervalMs = 60000): boolean {
  const session = getSessionTracker(sessionId);
  const lastSent = session.contactSentMap.get(contactIdentifier);
  const now = Date.now();
  if (lastSent && now - lastSent < throttleIntervalMs) {
    return false; // throttled / duplicate prevention
  }
  session.contactSentMap.set(contactIdentifier, now);
  return true;
}
