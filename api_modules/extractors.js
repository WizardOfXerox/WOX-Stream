const crypto = require('crypto');
const vm = require('vm');

// ==========================================
// SECTION A: Pure JS RC4 & CryptoAES
// ==========================================
function rc4Decrypt(dataBytes, keyString) {
  const key = Buffer.from(keyString, 'utf8');
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    S[i] = i;
  }
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) % 256;
    const temp = S[i];
    S[i] = S[j];
    S[j] = temp;
  }

  let i = 0;
  j = 0;
  const output = Buffer.alloc(dataBytes.length);
  for (let k = 0; k < dataBytes.length; k++) {
    i = (i + 1) % 256;
    j = (j + S[i]) % 256;
    const temp = S[i];
    S[i] = S[j];
    S[j] = temp;
    const K = S[(S[i] + S[j]) % 256];
    output[k] = dataBytes[k] ^ K;
  }
  return output;
}

function generateKeyAndIV(keyLength, ivLength, iterations, salt, password) {
  const digestLength = 16;
  const totalNeeded = keyLength + ivLength;
  let generatedData = Buffer.alloc(0);
  let currentBlock = Buffer.alloc(0);

  while (generatedData.length < totalNeeded) {
    const md5 = crypto.createHash('md5');
    if (currentBlock.length > 0) {
      md5.update(currentBlock);
    }
    md5.update(password);
    md5.update(salt);
    currentBlock = md5.digest();

    for (let i = 1; i < iterations; i++) {
      currentBlock = crypto.createHash('md5').update(currentBlock).digest();
    }
    generatedData = Buffer.concat([generatedData, currentBlock]);
  }

  return [
    generatedData.slice(0, keyLength),
    generatedData.slice(keyLength, keyLength + ivLength)
  ];
}

function cryptoAESDecrypt(cipherTextBase64, password) {
  try {
    const ctBytes = Buffer.from(cipherTextBase64, 'base64');
    if (ctBytes.length < 16) return '';

    const saltBytes = ctBytes.slice(8, 16);
    const cipherTextBytes = ctBytes.slice(16);

    const [keyBytes, ivBytes] = generateKeyAndIV(32, 16, 1, saltBytes, Buffer.from(password, 'utf8'));
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBytes, ivBytes);
    let decrypted = decipher.update(cipherTextBytes, null, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return '';
  }
}

// ==========================================
// SECTION B: JsUnpacker (Dean Edwards Packer)
// ==========================================
function parseRadix62(str) {
  let result = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    let digit = 0;
    if (code >= 48 && code <= 57) {
      digit = code - 48;
    } else if (code >= 97 && code <= 122) {
      digit = code - 87;
    } else if (code >= 65 && code <= 90) {
      digit = code - 29;
    }
    result = result * 62 + digit;
  }
  return result;
}

function jsUnpack(script) {
  try {
    const startIndex = script.indexOf("}('");
    if (startIndex === -1) return '';
    const endIndex = script.indexOf(".split('|'),0,{}))", startIndex);
    if (endIndex === -1) return '';

    const packed = script.substring(startIndex + 3, endIndex).replace(/\\'/g, '"');

    const splitIdx = packed.indexOf("',");
    if (splitIdx === -1) return '';

    const data = packed.substring(0, splitIdx);
    const remainder = packed.substring(splitIdx + 2);

    const dictStart = remainder.indexOf("'");
    if (dictStart === -1) return '';
    const dictEnd = remainder.indexOf("'", dictStart + 1);
    if (dictEnd === -1) return '';

    const dictionary = remainder.substring(dictStart + 1, dictEnd).split('|');
    const size = dictionary.length;

    return data.replace(/[0-9A-Za-z]+/g, (match) => {
      const index = parseRadix62(match);
      if (index < size && dictionary[index]) {
        return dictionary[index];
      }
      return match;
    });
  } catch (e) {
    return '';
  }
}

// ==========================================
// SECTION C: VidSrc WASM / Direct Extractor
// ==========================================
async function extractVidSrcWasm(tmdbId, isTv = false, season = 1, episode = 1) {
  try {
    const typeStr = isTv ? 'tv' : 'movie';
    const epStr = isTv ? `&season=${season}&episode=${episode}` : '';
    const apiUrl = `https://data.vidsrcme.ru/api.php?type=${typeStr}&tmdb=${tmdbId}${epStr}&stream_urls`;

    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://cloudorchestranova.com/'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;

    const j = await res.json();
    if (!j || !j.data) return null;

    let urls = [];
    if (Array.isArray(j.data.stream_urls)) {
      urls = j.data.stream_urls;
    } else if (typeof j.data.stream_urls === 'string' && j.vs && j.vs.wasm_url) {
      const wasmRes = await fetch(j.vs.wasm_url, { signal: AbortSignal.timeout(6000) });
      const wasmBuffer = await wasmRes.arrayBuffer();

      const mod = await WebAssembly.compile(wasmBuffer);
      const inst = await WebAssembly.instantiate(mod, {});
      const ex = inst.exports;

      const enc = Buffer.from(j.data.stream_urls, 'base64');
      const ptr = ex.alloc(enc.length);
      new Uint8Array(ex.memory.buffer, ptr, enc.length).set(enc);
      const outLen = ex.decrypt(ptr, enc.length);
      const decrypted = new TextDecoder().decode(new Uint8Array(ex.memory.buffer, ptr + 12, outLen));
      urls = decrypted.split('\n').filter(Boolean);
    }

    if (urls.length === 0) return null;

    return {
      url: urls[0],
      type: 'hls',
      referer: 'https://cloudorchestranova.com/',
      subtitles: []
    };
  } catch (e) {
    console.error('[VidSrc WASM Extractor Error]:', e.message);
    return null;
  }
}

async function extractVidSrc(vidsrcUrl) {
  try {
    // Parse TMDB ID or TV parameters from vidsrcUrl
    let tmdbId = '';
    let isTv = false;
    let season = 1;
    let episode = 1;

    if (vidsrcUrl.includes('/movie/')) {
      tmdbId = vidsrcUrl.substring(vidsrcUrl.lastIndexOf('/') + 1).split('?')[0];
    } else if (vidsrcUrl.includes('/tv/')) {
      isTv = true;
      const parts = vidsrcUrl.split('/tv/')[1].split('?')[0].split('/');
      tmdbId = parts[0];
      if (parts[1]) season = parseInt(parts[1], 10) || 1;
      if (parts[2]) episode = parseInt(parts[2], 10) || 1;
    }

    if (tmdbId) {
      const wasmResult = await extractVidSrcWasm(tmdbId, isTv, season, episode);
      if (wasmResult) return wasmResult;
    }
  } catch (e) {
    console.error('[VidSrc Extractor Error]:', e.message);
  }
  return null;
}

// ==========================================
// SECTION D: MegaCloud / RapidCloud Extractor
// ==========================================
const MEGACLOUD_CONFIG = {
  serverUrl: 'https://megacloud.tv',
  sourcesUrl: '/embed-2/ajax/e-1/getSources?id=',
  sourcesSplitter: '/e-1/',
  scriptUrl: 'https://megacloud.tv/js/player/a/prod/e1-player.min.js'
};
const RAPIDCLOUD_CONFIG = {
  serverUrl: 'https://rapid-cloud.co',
  sourcesUrl: '/ajax/embed-6-v2/getSources?id=',
  sourcesSplitter: '/embed-6-v2/',
  scriptUrl: 'https://rapid-cloud.co/js/player/prod/e6-player-v2.min.js'
};

const keyCache = new Map();

async function parseIndexPairs(scriptUrl) {
  const cached = keyCache.get(scriptUrl);
  if (cached && (Date.now() - cached.time < 3600000)) return cached.pairs;

  const res = await fetch(scriptUrl, {
    headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(6000)
  });
  const script = await res.text();

  const regex = /case\s*0x[0-9a-f]+:(?![^;]*=partKey)\s*\w+\s*=\s*(\w+)\s*,\s*\w+\s*=\s*(\w+);/g;
  const pairs = [];
  let match;
  while ((match = regex.exec(script)) !== null) {
    const var1 = match[1];
    const var2 = match[2];

    const r1 = new RegExp(`,${var1}=((?:0x)?([0-9a-fA-F]+))`);
    const r2 = new RegExp(`,${var2}=((?:0x)?([0-9a-fA-F]+))`);

    const m1 = r1.exec(script);
    const m2 = r2.exec(script);

    if (m1 && m2) {
      const v1Hex = m1[1].replace(/^0x/, '');
      const v2Hex = m2[1].replace(/^0x/, '');
      const p1 = parseInt(v1Hex, 16);
      const p2 = parseInt(v2Hex, 16);
      if (!isNaN(p1) && !isNaN(p2)) {
        pairs.push([p1, p2]);
      }
    }
  }

  if (pairs.length > 0) {
    keyCache.set(scriptUrl, { pairs, time: Date.now() });
  }
  return pairs;
}

function cipherTextCleaner(data, indexPairs) {
  let password = '';
  let ciphertext = data;
  let offset = 0;

  for (const [startIdx, length] of indexPairs) {
    const start = startIdx + offset;
    const end = start + length;
    const passSubstr = data.substring(start, end);
    password += passSubstr;
    ciphertext = ciphertext.replace(passSubstr, '');
    offset += length;
  }

  return { ciphertext, password };
}

async function extractMegaCloud(embedUrl) {
  try {
    const config = embedUrl.startsWith('https://megacloud.tv') ? MEGACLOUD_CONFIG : RAPIDCLOUD_CONFIG;
    let id = embedUrl.substring(embedUrl.indexOf(config.sourcesSplitter) + config.sourcesSplitter.length);
    if (id.includes('?')) id = id.substring(0, id.indexOf('?'));

    const res = await fetch(`${config.serverUrl}${config.sourcesUrl}${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest'
      },
      signal: AbortSignal.timeout(6000)
    });
    const data = await res.json();

    let masterUrl = '';
    if (!data.encrypted && Array.isArray(data.sources)) {
      masterUrl = data.sources[0]?.file || '';
    } else if (data.encrypted && typeof data.sources === 'string') {
      const indexPairs = await parseIndexPairs(config.scriptUrl);
      const { ciphertext, password } = cipherTextCleaner(data.sources, indexPairs);
      const decryptedStr = cryptoAESDecrypt(ciphertext, password);
      if (decryptedStr) {
        const sources = JSON.parse(decryptedStr);
        if (Array.isArray(sources) && sources[0]) {
          masterUrl = sources[0].file;
        }
      }
    }

    if (!masterUrl) return null;

    const subtitles = (data.tracks || [])
      .filter(t => t.kind === 'captions')
      .map(t => ({ url: t.file, label: t.label || 'Subtitle' }));

    return {
      url: masterUrl,
      type: 'hls',
      referer: `https://${new URL(embedUrl).host}/`,
      subtitles
    };
  } catch (e) {
    console.error('[MegaCloud Extractor Error]:', e.message);
    return null;
  }
}

// ==========================================
// SECTION E: Filemoon Extractor
// ==========================================
async function extractFilemoon(embedUrl) {
  try {
    const host = new URL(embedUrl).host;
    const res = await fetch(embedUrl, {
      headers: {
        'Referer': embedUrl,
        'Origin': `https://${host}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(6000)
    });
    const html = await res.text();

    const evalMatch = html.match(/eval\(function\(p,a,c,k,e,d\).*?m3u8.*?\)\)/s) ||
                      html.match(/eval\(function\(p,a,c,k,e,d\).*?\)/s);
    if (!evalMatch) return null;

    const unpacked = jsUnpack(evalMatch[0]);
    if (!unpacked) return null;

    const masterUrl = unpacked.split('{file:"')[1]?.split('"}')[0] ||
                      unpacked.split('file:"')[1]?.split('"')[0];
    if (!masterUrl) return null;

    let subtitles = [];
    const urlObj = new URL(embedUrl);
    let subUrl = urlObj.searchParams.get('sub.info');
    if (!subUrl && unpacked.includes("fetch('")) {
      subUrl = unpacked.split("fetch('")[1]?.split("').")[0];
    }
    if (subUrl) {
      try {
        const subRes = await fetch(subUrl, {
          headers: { 'Referer': embedUrl, 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4000)
        });
        const subData = await subRes.json();
        if (Array.isArray(subData)) {
          subtitles = subData.map(s => ({ url: s.file, label: s.label || 'Subtitle' }));
        }
      } catch (_) {}
    }

    return {
      url: masterUrl,
      type: 'hls',
      referer: `https://${host}/`,
      subtitles
    };
  } catch (e) {
    console.error('[Filemoon Extractor Error]:', e.message);
    return null;
  }
}

async function verifyStreamUrl(result) {
  if (!result || !result.url) return null;
  try {
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*'
    };
    if (result.referer) {
      fetchHeaders['Referer'] = result.referer;
      try { fetchHeaders['Origin'] = new URL(result.referer).origin; } catch (_) {}
    }
    const checkRes = await fetch(result.url, {
      method: 'GET',
      headers: fetchHeaders,
      signal: AbortSignal.timeout(3500)
    });
    if (checkRes.ok || checkRes.status === 206) {
      return result;
    }
    console.warn(`[Extractor Probe Failed]: ${result.url} returned status ${checkRes.status}`);
    return null;
  } catch (e) {
    console.warn(`[Extractor Probe Error]: ${e.message}`);
    return null;
  }
}

// ==========================================
// SECTION F: Master Extractor Router
// ==========================================
async function extractStream(embedUrl) {
  if (!embedUrl || typeof embedUrl !== 'string') return null;
  try {
    const hostname = new URL(embedUrl).hostname;
    let res = null;

    if (hostname.includes('vidsrc') || hostname.includes('vsembed') || hostname.includes('vidplay') || hostname.includes('cloudorchestranova')) {
      res = await extractVidSrc(embedUrl);
    } else if (hostname.includes('megacloud') || hostname.includes('rapid-cloud')) {
      res = await extractMegaCloud(embedUrl);
    } else if (hostname.includes('filemoon') || hostname.includes('moonplayer')) {
      res = await extractFilemoon(embedUrl);
    }

    if (res) {
      const verified = await verifyStreamUrl(res);
      if (verified) return verified;
    }
  } catch (e) {
    console.error(`[extractStream Error for ${embedUrl}]:`, e.message);
  }
  return null;
}

module.exports = {
  extractStream,
  extractVidSrc,
  extractVidSrcWasm,
  extractMegaCloud,
  extractFilemoon,
  cryptoAESDecrypt,
  jsUnpack,
  rc4Decrypt
};
