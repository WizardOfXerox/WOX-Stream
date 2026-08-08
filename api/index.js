const path = require('path');
const url = require('url');

// Single Vercel Serverless Function entry point
module.exports = async (req, res) => {
  const host = req.headers.host || 'localhost';
  const reqUrl = new URL(req.url || '/api/home', `http://${host}`);
  let pathname = reqUrl.pathname.replace(/^\/api\/?/, '').split('?')[0];

  if (!pathname || pathname === 'index') pathname = 'home';
  if (pathname.includes('/')) pathname = pathname.split('/')[0];

  try {
    const handlerPath = path.join(__dirname, '..', 'api_modules', `${pathname}.js`);
    const handler = require(handlerPath);
    return await handler(req, res);
  } catch (err) {
    console.error(`Dynamic API Routing Error for [${pathname}] (path: ${reqUrl.pathname}):`, err.stack || err.message);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(404).json({ success: false, error: `API Route /api/${pathname} not found`, message: err.message });
  }
};
