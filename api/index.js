const url = require('url');
const { applySecurityHeaders } = require('../api_modules/_security');
const { checkRateLimit, isBotBlocked } = require('../api_modules/_rateLimiter');
let handleSsrMeta = null;
try { handleSsrMeta = require('../api_modules/ssr-meta').handleSsrMeta; } catch (_) {}

// Static registry mapping of all API handler modules for Vercel bundling
const MODULE_REGISTRY = {
  'home': require('../api_modules/home'),
  'search': require('../api_modules/search'),
  'calendar': require('../api_modules/calendar'),
  'detail': require('../api_modules/detail'),
  'stream': require('../api_modules/stream'),
  'episode': require('../api_modules/episode'),
  'subtitle': require('../api_modules/subtitle'),
  'image': require('../api_modules/image'),
  'asian-drama': require('../api_modules/asian-drama'),
  'narto': require('../api_modules/narto'),
  'classics': require('../api_modules/classics'),
  'hollywood': require('../api_modules/hollywood'),
  'collection': require('../api_modules/collection'),
  'history': require('../api_modules/history'),
  'appointments': require('../api_modules/appointments'),
  'reportProgress': require('../api_modules/reportProgress'),
  'user': require('../api_modules/user'),
  'auth': require('../api_modules/auth'),
  'login': require('../api_modules/login'),
  'loginThirdParty': require('../api_modules/loginThirdParty'),
  'convert-mp4': require('../api_modules/convert-mp4'),
  'hstream': require('../api_modules/hstream'),
  'hentaimama': require('../api_modules/hentaimama'),
  'adult': require('../api_modules/adult'),
  'anime-provider': require('../api_modules/anime-provider'),
  'import-db': require('../api_modules/import-db'),
  'stream-party': require('../api_modules/stream-party'),
  'cover-lookup': require('../api_modules/cover-lookup'),
  'resolve-embed': require('../api_modules/resolve-embed'),
  'sitemap': require('../api_modules/sitemap')
};

// Single Vercel Serverless Function entry point
module.exports = async (req, res) => {
  const reqUrl = req.url || '';
  const parsed = url.parse(reqUrl, true);
  
  let pathname = (req.query && req.query.pathname) || (parsed.query && parsed.query.pathname);
  
  if (!pathname) {
    const rawPath = (req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || parsed.pathname || '/api/home').split('?')[0];
    pathname = rawPath.replace(/^\/api\/?/, '');
  }

  if (!pathname || pathname === 'index') pathname = 'home';
  if (pathname.includes('/')) pathname = pathname.split('/')[0];
  if (pathname.includes('?')) pathname = pathname.split('?')[0];

  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, token, wox-token');
    return res.status(200).end();
  }

  applySecurityHeaders(res);

  const { blocked, isLegitBot } = isBotBlocked(req);
  if (blocked && !isLegitBot) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: false, error: 'Forbidden' }));
  }

  let rateLimitGroup = 'metadata';
  if (['stream', 'convert-mp4'].includes(pathname)) {
    rateLimitGroup = 'stream';
  } else if (['episode', 'subtitle', 'hstream', 'hentaimama', 'adult'].includes(pathname)) {
    rateLimitGroup = 'episode';
  }

  if (!checkRateLimit(req, res, rateLimitGroup)) {
    return;
  }

  const handler = MODULE_REGISTRY[pathname];
  if (handler) {
    try {
      return await handler(req, res);
    } catch (err) {
      console.error(`Execution Error for [/api/${pathname}]:`, err.stack || err.message);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(404, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ success: false, error: `API Route /api/${pathname} not found` }));
};
