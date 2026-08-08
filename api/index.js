const path = require('path');
const url = require('url');

// Dynamic Handler Gateway for single Vercel Serverless Function entry point
module.exports = async (req, res) => {
  const reqUrl = req.url || '';
  const parsed = url.parse(reqUrl, true);
  let pathname = parsed.pathname.replace(/^\/api\/?/, '');

  if (!pathname || pathname === 'index') pathname = 'home';
  if (pathname.includes('/')) pathname = pathname.split('/')[0];

  try {
    const handlerPath = path.join(__dirname, `${pathname}.js`);
    const handler = require(handlerPath);
    return await handler(req, res);
  } catch (err) {
    console.error(`Dynamic API Routing Error for [${pathname}]:`, err.message);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(404).json({ success: false, error: `API Route /api/${pathname} not found` });
  }
};
