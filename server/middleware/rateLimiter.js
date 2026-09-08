/**
 * In-memory sliding window rate limiter middleware
 * Provides IP-based rate limiting without external Redis dependencies
 */
export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000, // 15 minutes
  max = 100, // max requests per window
  message = 'Too many requests from this IP, please try again later.'
} = {}) => {
  const requests = new Map();

  // Periodic cleanup of expired entries
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requests.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, valid);
      }
    }
  }, windowMs);

  if (cleanupInterval.unref) cleanupInterval.unref();

  return (req, res, next) => {
    // Get client IP address
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    const timestamps = requests.get(ip) || [];
    const recent = timestamps.filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    recent.push(now);
    requests.set(ip, recent);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - recent.length);
    next();
  };
};

// Strict rate limiter for authentication endpoints (login, register)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per 15 minutes
  message: 'Too many authentication attempts. Please try again in 15 minutes.'
});

// General API rate limiter
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 240, // 240 requests per minute
  message: 'Too many requests, please slow down.'
});
