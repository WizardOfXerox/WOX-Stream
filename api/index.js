const url = require('url');

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
  'viva': require('../api_modules/viva'),
  'anime-provider': require('../api_modules/anime-provider'),
  'import-db': require('../api_modules/import-db'),
  'stream-party': require('../api_modules/stream-party')
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

  const handler = MODULE_REGISTRY[pathname];
  if (handler) {
    try {
      return await handler(req, res);
    } catch (err) {
      console.error(`Execution Error for [/api/${pathname}]:`, err.stack || err.message);
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(404).json({ success: false, error: `API Route /api/${pathname} not found` });
};
