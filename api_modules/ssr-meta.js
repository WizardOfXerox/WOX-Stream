const fs = require('fs');
const path = require('path');

const LEGIT_BOTS = ['Googlebot', 'facebookexternalhit', 'Twitterbot', 'Discordbot', 'LinkedInBot', 'Slackbot', 'WhatsApp', 'TelegramBot'];
let cachedIndexHtml = null;

async function handleSsrMeta(req, res, pathname) {
  const ua = req.headers['user-agent'] || '';
  let isBot = false;
  for (const bot of LEGIT_BOTS) {
    if (ua.includes(bot)) {
      isBot = true;
      break;
    }
  }

  if (isBot && pathname && pathname.startsWith('title/')) {
    const parts = pathname.split('/');
    if (parts.length > 1) {
      const id = parts[1];
      try {
        const detailHandler = require('./detail');
        // Mock a req/res for the internal call if possible, but actually we need the data
        // detail handler usually writes to res. It's easier to mock res or extract logic.
        // Wait, the instruction says "Fetch detail data internally from the detail module".
        // Let's create a mock response object to capture the data.
        
        const mockRes = {
          data: null,
          status: function() { return this; },
          json: function(obj) { this.data = obj; return this; },
          setHeader: function() {}
        };
        const mockReq = { ...req, query: { id } };
        
        await detailHandler(mockReq, mockRes);
        
        if (mockRes.data && mockRes.data.success && mockRes.data.data) {
          const detailData = mockRes.data.data;
          
          if (!cachedIndexHtml) {
            const indexPath = path.join(__dirname, '..', 'public', 'index.html');
            if (fs.existsSync(indexPath)) {
              cachedIndexHtml = fs.readFileSync(indexPath, 'utf-8');
            } else {
              return null;
            }
          }
          
          const escHtml = (s) => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          const title = escHtml(detailData.name || 'WOX-Stream');
          const description = escHtml((detailData.introduction || 'Watch movies and TV shows on WOX-Stream.').substring(0, 200));
          const image = detailData.coverVerticalUrl || detailData.coverHorizontalUrl || '';
          const pageUrl = `https://${req.headers.host || 'stream.wox.world'}/title/${id}`;
          
          const metaTags = `
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:type" content="video.movie">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:image" content="${image}">
          `;
          
          const modifiedHtml = cachedIndexHtml.replace('</head>', `${metaTags}\n</head>`);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(modifiedHtml);
          return true; // Indicate handled
        }
      } catch (err) {
        console.error("SSR Meta Error:", err);
      }
    }
  }
  
  return null;
}

module.exports = {
  handleSsrMeta
};
