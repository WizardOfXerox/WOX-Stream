const http = require('http');
const fs = require('fs');
const path = require('path');
const { applySecurityHeaders } = require('./api_modules/_security');
const { isBotBlocked } = require('./api_modules/_rateLimiter');

if (fs.existsSync(path.join(__dirname, '.env'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*["']?(.*?)["']?\s*$/);
    if (match) process.env[match[1]] = match[2];
  });
}

const homeHandler = require('./api_modules/home');
const searchHandler = require('./api_modules/search');
const detailHandler = require('./api_modules/detail');
const episodeHandler = require('./api_modules/episode');
const historyHandler = require('./api_modules/history');
const reportProgressHandler = require('./api_modules/reportProgress');
const loginHandler = require('./api_modules/login');
const loginThirdPartyHandler = require('./api_modules/loginThirdParty');
const imageHandler = require('./api_modules/image');
const streamHandler = require('./api_modules/stream');
const subtitleHandler = require('./api_modules/subtitle');
const authHandler = require('./api_modules/auth');
const calendarHandler = require('./api_modules/calendar');
const collectionHandler = require('./api_modules/collection');
const appointmentsHandler = require('./api_modules/appointments');
const importDbHandler = require('./api_modules/import-db');

const convertMp4Handler = require('./api_modules/convert-mp4');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer({
  maxHeaderSize: 131072, // 128 KB header limit to prevent HTTP 431 errors
  insecureHTTPParser: true
}, async (req, res) => {
  // Use WHATWG URL API to prevent DEP0169 DeprecationWarning
  const host = req.headers.host || `localhost:${PORT}`;
  const reqUrl = new URL(req.url, `http://${host}`);
  const pathname = reqUrl.pathname;

  const query = {};
  reqUrl.searchParams.forEach((val, key) => {
    query[key] = val;
  });
  req.query = query;

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    await new Promise(resolve => req.on('end', resolve));
    try {
      req.body = JSON.parse(body);
    } catch (_) {
      req.body = {};
    }
  }

  res.json = function (data) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  };
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };

  // Apply security headers to all responses
  applySecurityHeaders(res);

  function getHandler(modName) {
    const modPath = path.join(__dirname, 'api_modules', modName);
    try {
      delete require.cache[require.resolve(modPath)];
    } catch (_) {}
    return require(modPath);
  }

  // API Routes
  if (pathname === '/api/home') return getHandler('home')(req, res);
  if (pathname === '/api/search') return getHandler('search')(req, res);
  if (pathname === '/api/detail') return getHandler('detail')(req, res);
  if (pathname === '/api/episode') return getHandler('episode')(req, res);
  if (pathname === '/api/history') return getHandler('history')(req, res);
  if (pathname === '/api/reportProgress') return getHandler('reportProgress')(req, res);
  if (pathname === '/api/login') return getHandler('login')(req, res);
  if (pathname === '/api/loginThirdParty') return getHandler('loginThirdParty')(req, res);
  if (pathname === '/api/image') return getHandler('image')(req, res);
  if (pathname === '/api/stream') return getHandler('stream')(req, res);
  if (pathname === '/api/resolve-embed') return getHandler('resolve-embed')(req, res);
  if (pathname === '/api/subtitle') return getHandler('subtitle')(req, res);
  if (pathname === '/api/auth') return getHandler('auth')(req, res);
  if (pathname === '/api/calendar') return getHandler('calendar')(req, res);
  if (pathname === '/api/collection') return getHandler('collection')(req, res);
  if (pathname === '/api/appointments') return getHandler('appointments')(req, res);
  if (pathname === '/api/import-db') return getHandler('import-db')(req, res);
  if (pathname === '/api/convert-mp4') return getHandler('convert-mp4')(req, res);
  if (pathname === '/api/stream-party') return getHandler('stream-party')(req, res);
  if (pathname === '/api/cover-lookup') return getHandler('cover-lookup')(req, res);

  // Narto Drama API Routes
  if (pathname.startsWith('/api/narto')) {
    const nartoRouter = getHandler('narto');
    req.url = pathname.replace('/api/narto', '') || '/';
    return nartoRouter(req, res);
  }

  // Hollywood API Route
  if (pathname.startsWith('/api/hollywood')) {
    return getHandler('hollywood')(req, res);
  }

  // Anime API Route
  if (pathname.startsWith('/api/anime-provider')) {
    return getHandler('anime-provider')(req, res);
  }

  // Asian Drama API Route
  if (pathname.startsWith('/api/asian-drama')) {
    return getHandler('asian-drama')(req, res);
  }

  // Classics API Route
  if (pathname.startsWith('/api/classics')) {
    return getHandler('classics')(req, res);
  }

  // Adult API Route
  if (pathname.startsWith('/api/adult')) {
    return getHandler('adult')(req, res);
  }

  if (pathname === '/sitemap.xml') {
    return getHandler('sitemap')(req, res);
  }

  // SPA Fallback Routes — serve index.html for client-side routes
  const SPA_ROUTES = ['/title/', '/watch/', '/search', '/collection', '/history', '/profile'];
  const isSpaRoute = SPA_ROUTES.some(r => pathname === r || pathname.startsWith(r));
  if (isSpaRoute) {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    return fs.readFile(indexPath, (err, data) => {
      if (err) { res.statusCode = 500; return res.end('Internal Error'); }
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      res.end(data);
    });
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, indexData) => {
        if (err2) {
          res.statusCode = 404;
          res.end('Not Found');
        } else {
          res.setHeader('Content-Type', 'text/html');
          res.end(indexData);
        }
      });
    } else {
      res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
      if (ext === '.js' || ext === '.css' || ext === '.html') {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`  🚀 WOX-Stream Server is running locally!`);
  console.log(`  🌐 Open in Browser: http://localhost:${PORT}`);
  console.log(`===================================================`);
});
