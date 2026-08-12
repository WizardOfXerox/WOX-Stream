const crypto = require('crypto');

// In-memory sliding window rate limiter
const rateLimits = new Map();
let lastCleanup = Date.now();

function cleanupExpired() {
  const now = Date.now();
  if (now - lastCleanup > 5 * 60 * 1000) {
    for (const [key, data] of rateLimits.entries()) {
      if (now > data.resetTime) {
        rateLimits.delete(key);
      }
    }
    lastCleanup = now;
  }
}

function checkRateLimit(req, res, group) {
  cleanupExpired();
  
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const key = `${ip}:${group}`;
  const now = Date.now();

  let limit = 60;
  if (group === 'stream') limit = 180;
  if (group === 'episode') limit = 120;
  const windowMs = 60 * 1000;

  let data = rateLimits.get(key);
  if (!data || now > data.resetTime) {
    data = { count: 1, resetTime: now + windowMs };
  } else {
    data.count++;
  }
  
  rateLimits.set(key, data);

  if (data.count > limit) {
    const retryAfter = Math.ceil((data.resetTime - now) / 1000);
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) });
    res.end(JSON.stringify({ success: false, error: 'Too Many Requests', retryAfter }));
    return false;
  }
  
  return true;
}

const BAD_BOTS = ['python-requests', 'scrapy', 'curl/', 'wget/', 'aiohttp', 'httpx', 'Go-http-client', 'Java/', 'okhttp/3', 'libwww-perl'];
const LEGIT_BOTS = ['Googlebot', 'facebookexternalhit', 'Twitterbot', 'Discordbot', 'LinkedInBot', 'Slackbot', 'WhatsApp', 'TelegramBot'];

function isBotBlocked(req) {
  const ua = req.headers['user-agent'] || '';
  let blocked = false;
  let isLegitBot = false;

  for (const bot of BAD_BOTS) {
    if (ua.includes(bot)) {
      blocked = true;
      break;
    }
  }

  for (const bot of LEGIT_BOTS) {
    if (ua.includes(bot)) {
      isLegitBot = true;
      break;
    }
  }

  return { blocked, isLegitBot };
}

const HMAC_SECRET = process.env.HMAC_SECRET || 'wox_stream_default_key_2024';

function generateStreamToken(url) {
  const exp = Date.now() + 4 * 60 * 60 * 1000; // 4 hours
  const token = crypto.createHmac('sha256', HMAC_SECRET).update(url + '|' + exp).digest('hex');
  return { token, exp };
}

function validateStreamToken(url, token, exp) {
  if (!url || !token || !exp) return false;
  if (Date.now() > exp) return false;
  const expected = crypto.createHmac('sha256', HMAC_SECRET).update(url + '|' + exp).digest('hex');
  return token === expected;
}

function getRouteGroup(pathname) {
  const route = pathname.replace('/api/', '').split('?')[0];
  if (['stream', 'convert-mp4'].includes(route)) return 'stream';
  if (['episode', 'subtitle', 'hstream', 'hentaimama', 'adult'].includes(route)) return 'episode';
  return 'metadata';
}

module.exports = {
  checkRateLimit,
  isBotBlocked,
  generateStreamToken,
  validateStreamToken,
  getRouteGroup
};
