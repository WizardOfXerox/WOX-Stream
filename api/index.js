const path = require('path');

// Single Vercel Serverless Function entry point
module.exports = async (req, res) => {
  const matchedPath = req.headers['x-matched-path'] || req.url || '/api/home';
  const rawPath = matchedPath.split('?')[0];
  let pathname = rawPath.replace(/^\/api\/?/, '');

  if (!pathname || pathname === 'index') pathname = 'home';
  if (pathname.includes('/')) pathname = pathname.split('/')[0];

  try {
    const handlerPath = path.join(__dirname, '..', 'api_modules', `${pathname}.js`);
    const handler = require(handlerPath);
    return await handler(req, res);
  } catch (err) {
    console.error(`Dynamic API Routing Error for [${pathname}] (rawPath: ${rawPath}):`, err.stack || err.message);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(404).json({ success: false, error: `API Route /api/${pathname} not found`, message: err.message });
  }
};
