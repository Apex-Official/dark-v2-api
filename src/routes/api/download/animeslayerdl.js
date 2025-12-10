import express from "express";
import axios from "axios";

const router = express.Router();

// 🔒 وظائف فك التشفير الأساسية
function base64Decode(s) {
  const e = {};
  let i, b = 0, c, x, l = 0, a, r = '';
  const w = String.fromCharCode;
  const L = s.length;
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  
  for (i = 0; i < 64; i++) {
    e[A.charAt(i)] = i;
  }
  
  for (x = 0; x < L; x++) {
    c = e[s.charAt(x)];
    b = (b << 6) + c;
    l += 6;
    while (l >= 8) {
      ((a = (b >>> (l -= 8)) & 0xff) || (x < (L - 2))) && (r += w(a));
    }
  }
  return r;
}

function base64DecodeAscii(s) {
  s = String(s).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const rev = new Uint8Array(256);
  
  for (let i = 0; i < 256; i++) rev[i] = 255;
  for (let i = 0; i < alphabet.length; i++) rev[alphabet.charCodeAt(i)] = i;
  
  const bytes = [];
  let buffer = 0, bits = 0;
  
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 61) break;
    const v = rev[c];
    if (v === 255) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 0xFF);
    }
  }
  
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function unpack(str) {
  const get_chunks = (str) => {
    const chunks = str.match(/eval\(\(?function\(.*?(,0,\{\}\)\)|split\('\|'\)\)\))($|\n)/g);
    return chunks || [];
  };
  
  const chunks = get_chunks(str);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i].replace(/\n$/, '');
    try {
      const unpacked = eval(chunk);
      str = str.split(chunk).join(unpacked);
    } catch (e) {
      console.error('Unpack error:', e);
    }
  }
  return str;
}

// ⚙️ وظائف المساعدة
function getMatches(string, regex, index = 1) {
  const matches = [];
  let match;
  while ((match = regex.exec(string))) {
    matches.push(match[index]);
  }
  return matches;
}

function getLocation(href) {
  const match = href.match(/^(https?\:)\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);
  return match && {
    href,
    protocol: match[1],
    host: match[2],
    hostname: match[3],
    port: match[4],
    pathname: match[5],
    search: match[6],
    hash: match[7]
  };
}

// 🎥 وظائف فك الترميز الخاصة بالخوادم
function mixdrop(url, content) {
  const urls = [];
  const myRegEx = /\s+?(eval\(function\(p,a,c,k,e,d\).+)\s+?/g;
  const matches = getMatches(content, myRegEx, 1);
  
  if (matches.length > 0) {
    const unpacked = unpack(matches[0]);
    const link = "https:" + getMatches(unpacked, /wurl=\"([^\"]+)/g, 1)[0].replace('\\', '');
    urls.push(link);
  }
  
  const lo = getLocation(url);
  return { type: 5, url, host: lo.hostname, urls };
}

function mp4upload(url, content) {
  const urls = [];
  const myRegEx = /script"?'?>(eval.*?).split/g;
  const matches = getMatches(content, myRegEx, 1);
  
  if (matches.length > 0) {
    const m = matches[0] + ".split('|')))";
    const unpacked = unpack(m);
    const link = getMatches(unpacked, /src\("([^"]+)/g, 1)[0].replace('\\', '');
    urls.push(link);
  }
  
  const lo = getLocation(url);
  return { type: 5, url, host: lo.hostname, urls };
}

function mediafire(url, content) {
  const urls = [];
  const myRegEx = /data-scrambled-url="(.*?)"/g;
  const matches = getMatches(content, myRegEx, 1);
  
  for (let i = 0; i < matches.length; i++) {
    if (matches[i]) {
      urls.push(base64DecodeAscii(matches[i]));
    }
  }
  
  const lo = getLocation(url);
  return { type: 0, url, host: lo.hostname, urls };
}

function streamtape(url, content) {
  const urls = [];
  const myRegEx = /robotlink'\).innerHTML = '(.*)'\+ \('(.*)'\)/g;
  const matches = getMatches(content, myRegEx);
  
  if (matches.length >= 2) {
    const link = "https:" + matches[0] + matches[1];
    urls.push(link);
  }
  
  const lo = getLocation(url);
  return { type: 5, url, host: lo.hostname, urls };
}

function vidoza(url, content) {
  const urls = [];
  const myRegEx = /sourcesCode:\s*(\[.*?\])/gs;
  const matches = getMatches(content, myRegEx, 1);
  
  if (matches.length > 0) {
    try {
      const sources = JSON.parse(matches[0].replace(/'/g, '"'));
      sources.forEach(source => {
        if (source.src) urls.push(source.src);
      });
    } catch (e) {
      console.error('Vidoza parse error:', e);
    }
  }
  
  const lo = getLocation(url);
  return { type: 5, url, host: lo.hostname, urls };
}

// 🔗 دالة التوجيه الرئيسية
function getServer(url, content) {
  if (url.includes("mixdrop")) return mixdrop(url, content);
  if (url.includes("mp4upload")) return mp4upload(url, content);
  if (url.includes("mediafire")) return mediafire(url, content);
  if (url.includes("streamtape")) return streamtape(url, content);
  if (url.includes("vidoza")) return vidoza(url, content);
  
  return {
    type: 997,
    url,
    host: getLocation(url).hostname,
    urls: [],
    error: "Server handler not found"
  };
}

// 📦 VideoDecoder Class
class VideoDecoder {
  static prepareRequest(url, config = {}) {
    let newUrl = url;
    let method = 'GET';
    
    if (url.includes("ok.ru")) {
      method = 'POST';
    } else if (url.includes("streamtape")) {
      newUrl = url.replace('/e/', '/v/');
    } else if (url.includes("roberteachfinal")) {
      newUrl = url.replace('roberteachfinal', 'robertordercharacter');
    } else if (url.includes('fembed') || config.rq === 1) {
      method = 'POST';
    }
    
    if (config.rq === 2) method = 'WEBVIEW';
    if (config.rq === 3) method = 'WEBVIEW_LOAD';
    
    return { url: newUrl, method };
  }
  
  static decodeContent(url, content) {
    try {
      return getServer(url, content);
    } catch (error) {
      console.error("Decoding Error:", error);
      const lo = getLocation(url);
      return {
        type: 998,
        url,
        host: lo.hostname,
        urls: [],
        error: error.message
      };
    }
  }
  
  static getServersList() {
    return [
      { name: "mp4upload", shorten: "MD", v: 15, optional: true },
      { name: "mixdrop", shorten: "MX", v: 16, optional: true },
      { name: "mediafire", shorten: "MF", v: 17, optional: true },
      { name: "streamtape", shorten: "ST", v: 18, optional: true },
      { name: "vidoza", shorten: "VZ", v: 19, optional: true }
    ];
  }
}

// 🧩 POST Route
router.post("/", async (req, res) => {
  try {
    const { embedUrl } = req.body;
    
    if (!embedUrl) {
      return res.status(400).json({
        status: false,
        message: "⚠️ الرجاء إرسال رابط المشغل (embedUrl)"
      });
    }
    
    const { url, method } = VideoDecoder.prepareRequest(embedUrl, { rq: 0 });
    
    if (method === 'WEBVIEW' || method === 'WEBVIEW_LOAD') {
      return res.status(400).json({
        status: false,
        message: `⚠️ هذا الخادم يتطلب عرض الويب (${method})`
      });
    }
    
    let response;
    try {
      if (method === 'GET') {
        response = await axios.get(url, { timeout: 10000 });
      } else if (method === 'POST') {
        response = await axios.post(url, {}, { timeout: 10000 });
      }
    } catch (e) {
      return res.status(500).json({
        status: false,
        message: "❌ فشل جلب المحتوى من الرابط",
        error: e.message
      });
    }
    
    const result = VideoDecoder.decodeContent(response.config.url, response.data);
    
    if (result.urls && result.urls.length > 0) {
      res.json({
        status: true,
        message: "✅ تم فك الترميز بنجاح",
        data: {
          host: result.host,
          type: result.type,
          urls: result.urls
        }
      });
    } else {
      res.status(404).json({
        status: false,
        message: "❌ لم يتم العثور على روابط فيديو مباشرة",
        error: result.error || "غير معروف"
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ في معالجة الطلب",
      error: err.message
    });
  }
});

// 🧩 GET Route
router.get("/", async (req, res) => {
  try {
    const embedUrl = req.query.url || req.query.embedUrl;
    
    if (!embedUrl) {
      return res.status(400).json({
        status: false,
        message: "⚠️ الرجاء إرسال رابط المشغل (url أو embedUrl)"
      });
    }
    
    const { url, method } = VideoDecoder.prepareRequest(embedUrl, { rq: 0 });
    
    if (method === 'WEBVIEW' || method === 'WEBVIEW_LOAD') {
      return res.status(400).json({
        status: false,
        message: `⚠️ هذا الخادم يتطلب عرض الويب (${method})`
      });
    }
    
    let response;
    try {
      if (method === 'GET') {
        response = await axios.get(url, { timeout: 10000 });
      } else if (method === 'POST') {
        response = await axios.post(url, {}, { timeout: 10000 });
      }
    } catch (e) {
      return res.status(500).json({
        status: false,
        message: "❌ فشل جلب المحتوى من الرابط",
        error: e.message
      });
    }
    
    const result = VideoDecoder.decodeContent(response.config.url, response.data);
    
    if (result.urls && result.urls.length > 0) {
      res.json({
        status: true,
        message: "✅ تم فك الترميز بنجاح",
        data: {
          host: result.host,
          type: result.type,
          urls: result.urls
        }
      });
    } else {
      res.status(404).json({
        status: false,
        message: "❌ لم يتم العثور على روابط فيديو مباشرة",
        error: result.error || "غير معروف"
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ في معالجة الطلب",
      error: err.message
    });
  }
});

// 🧩 GET Servers List Route
router.get("/servers", (req, res) => {
  res.json({
    status: true,
    message: "✅ قائمة الخوادم المدعومة",
    servers: VideoDecoder.getServersList()
  });
});

export default router;