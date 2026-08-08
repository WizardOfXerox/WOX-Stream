const http = require('http');
const fs = require('fs');
const path = require('path');

const homeHandler = require('./api/home');
const searchHandler = require('./api/search');
const detailHandler = require('./api/detail');
const episodeHandler = require('./api/episode');
const historyHandler = require('./api/history');
const reportProgressHandler = require('./api/reportProgress');
const loginHandler = require('./api/login');
const loginThirdPartyHandler = require('./api/loginThirdParty');
const imageHandler = require('./api/image');
const streamHandler = require('./api/stream');
const subtitleHandler = require('./api/subtitle');
const authHandler = require('./api/auth');
const calendarHandler = require('./api/calendar');
const collectionHandler = require('./api/collection');
const appointmentsHandler = require('./api/appointments');
const importDbHandler = require('./api/import-db');

const convertMp4Handler = require('./api/convert-mp4');

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

const server = http.createServer(async (req, res) => {
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

  // API Routes
  if (pathname === '/api/home') return homeHandler(req, res);
  if (pathname === '/api/search') return searchHandler(req, res);
  if (pathname === '/api/detail') return detailHandler(req, res);
  if (pathname === '/api/episode') return episodeHandler(req, res);
  if (pathname === '/api/history') return historyHandler(req, res);
  if (pathname === '/api/reportProgress') return reportProgressHandler(req, res);
  if (pathname === '/api/login') return loginHandler(req, res);
  if (pathname === '/api/loginThirdParty') return loginThirdPartyHandler(req, res);
  if (pathname === '/api/image') return imageHandler(req, res);
  if (pathname === '/api/stream') return streamHandler(req, res);
  if (pathname === '/api/subtitle') return subtitleHandler(req, res);
  if (pathname === '/api/auth') return authHandler(req, res);
  if (pathname === '/api/calendar') return calendarHandler(req, res);
  if (pathname === '/api/collection') return collectionHandler(req, res);
  if (pathname === '/api/appointments') return appointmentsHandler(req, res);
  if (pathname === '/api/import-db') return importDbHandler(req, res);
  if (pathname === '/api/convert-mp4') return convertMp4Handler(req, res);

  // Viva Platforms API Routes
  if (pathname === '/api/viva' || pathname.startsWith('/api/viva')) {
    const vivaHandler = require('./api/viva');
    return vivaHandler(req, res);
  }

  // Narto Drama API Routes
  if (pathname.startsWith('/api/narto/')) {
    const nartoRouter = require('./api/narto');
    req.url = pathname.replace('/api/narto', '');
    return nartoRouter(req, res);
  }

  // Hollywood API Route
  if (pathname.startsWith('/api/hollywood')) {
    const hollywoodHandler = require('./api/hollywood');
    return hollywoodHandler(req, res);
  }

  // Anime API Route
  if (pathname.startsWith('/api/anime-provider')) {
    const animeHandler = require('./api/anime-provider');
    return animeHandler(req, res);
  }

  // Asian Drama API Route
  if (pathname.startsWith('/api/asian-drama')) {
    const dramaHandler = require('./api/asian-drama');
    return dramaHandler(req, res);
  }

  // Classics API Route
  if (pathname.startsWith('/api/classics')) {
    const classicsHandler = require('./api/classics');
    return classicsHandler(req, res);
  }

  // Adult API Route
  if (pathname.startsWith('/api/adult')) {
    const adultHandler = require('./api/adult');
    return adultHandler(req, res);
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
