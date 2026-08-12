/**
 * sitemap.js — Dynamic XML Sitemap Generator
 * WOX-Stream SEO Module
 */

const { setCorsHeaders } = require('./_utils');

module.exports = async (req, res) => {
  setCorsHeaders(res);
  const host = req.headers['host'] || 'stream.wox.world';
  const baseUrl = `https://${host}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/category</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/calendar</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/search</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
  return res.end(xml);
};
