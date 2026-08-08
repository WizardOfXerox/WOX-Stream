const path = require('path');
const url = require('url');

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

  try {
    const handlerPath = path.join(__dirname, '..', 'api_modules', `${pathname}.js`);
    const handler = require(handlerPath);
    return await handler(req, res);
  } catch (err) {
    console.error(`Dynamic API Routing Error for [${pathname}] (req.url: ${reqUrl}):`, err.message);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(404).json({ success: false, error: `API Route /api/${pathname} not found`, reqUrl: reqUrl });
  }
};
