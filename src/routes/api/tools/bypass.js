import express from "express";
import axios from "axios";

const router = express.Router();

// 🌐 قائمة البروكسيات
const PROXIES = [
  "https://cors.caliph.my.id/",
  "https://cors.eu.org/",
  "https://square.proxyserver2.workers.dev/",
  "https://rpoxy.apis6.workers.dev/",
  "https://aged-hill-ab3a.apis4.workers.dev/",
  "https://plain-wave-6f5f.apis1.workers.dev/",
  "https://young-hill-815e.apis3.workers.dev/",
  "https://icy-morning-72e2.apis2.workers.dev/",
  "https://young-surf-7189.apis7.workers.dev/",
  "https://cors.fazri.workers.dev/",
  "https://spring-night-57a1.3540746063.workers.dev/",
  "https://cors.sizable.workers.dev/",
  "https://jiashu.1win.eu.org/"
];

// 🔧 دالة لاستخراج siteKey من HTML
const extractSiteKey = (html) => {
  const matches = [
    /sitekey["']?\s*[:=]\s*["']([^"']+)["']/i,
    /data-sitekey=["']([^"']+)["']/i,
    /"siteKey"\s*:\s*"([^"]+)"/i,
    /turnstile\.render\([^,]+,\s*{\s*sitekey:\s*['"]([^'"]+)['"]/i,
    /'sitekey':\s*'([^']+)'/i,
    /"cf-turnstile"[^>]*data-sitekey="([^"]+)"/i
  ];
  
  for (const regex of matches) {
    const match = html.match(regex);
    if (match && match[1]) return match[1];
  }
  return null;
};

// 🚀 محاولة 1: استخدام ZenCF (عبر API مباشر)
const tryZencfBypass = async (url) => {
  try {
    const response = await axios.post('https://api.zencf.com/v1/source', 
      { url },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );
    
    if (response.data && response.data.source) {
      return { 
        success: true, 
        method: 'ZenCF API', 
        data: response.data 
      };
    }
    return { success: false, error: 'فشل ZenCF - لا يوجد محتوى' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// 🚀 محاولة 2: استخدام CFTO API
const tryCftoApiBypass = async (url, proxy = undefined) => {
  try {
    const response = await axios.post('https://cf.pitucode.com', 
      { url, mode: 'source', proxy },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );
    
    if (response.status === 200 && response.data.source) {
      return { success: true, method: 'CFTO API', data: response.data };
    }
    return { success: false, error: response.data.message || 'فشل CFTO API' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// 🚀 محاولة 3: استخدام CFTO WAF Session
const tryCftoWafBypass = async (url) => {
  try {
    const response = await axios.post('https://cf.pitucode.com', 
      { url, mode: 'waf-session' },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );
    
    if (response.status === 200 && response.data.cookies) {
      return { success: true, method: 'CFTO WAF Session', data: response.data };
    }
    return { success: false, error: 'فشل CFTO WAF' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// 🚀 محاولة 4: استخدام CFTO Turnstile
const tryCftoTurnstileBypass = async (url) => {
  try {
    // جلب الصفحة للحصول على siteKey
    const pageRes = await axios.get(url, { timeout: 10000 });
    const html = pageRes.data;
    const siteKey = extractSiteKey(html);
    
    if (siteKey) {
      const response = await axios.post('https://cf.pitucode.com', 
        { url, siteKey, mode: 'turnstile-min' },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );
      
      if (response.data && response.data.token) {
        return { 
          success: true, 
          method: 'CFTO Turnstile', 
          data: { ...response.data, siteKey } 
        };
      }
    }
    
    return { success: false, error: 'لم يتم العثور على siteKey أو فشل Turnstile' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// 🚀 محاولة 5: استخدام Hostrta API
const tryHostrtaBypass = async (url) => {
  try {
    // تحليل الصفحة
    const analyzeRes = await axios.get(`https://key.hostrta.win/api/analyze?url=${encodeURIComponent(url)}`, 
      { timeout: 15000 }
    );
    const analyzeData = analyzeRes.data;
    
    const siteKey = analyzeData.siteKey || analyzeData.sitekey;
    
    if (siteKey) {
      // تخطي Cloudflare
      const bypassRes = await axios.get(
        `https://key.hostrta.win/api/bypass?url=${encodeURIComponent(url)}&sitekey=${siteKey}`,
        { timeout: 30000 }
      );
      const bypassData = bypassRes.data;
      
      if (bypassData.success || bypassData.source) {
        return { success: true, method: 'Hostrta API', data: bypassData };
      }
    }
    
    return { success: false, error: 'لم يتم العثور على siteKey' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// 🚀 محاولة 6: استخدام Ahmose API
const tryAhmoseBypass = async (url) => {
  try {
    const response = await axios.get(
      `https://ahmoseapi.loca.lt/api/bypass/source?url=${encodeURIComponent(url)}`,
      { timeout: 30000 }
    );
    const result = response.data;
    
    if (result.success || result.source) {
      return { success: true, method: 'Ahmose API', data: result };
    }
    return { success: false, error: result.message || 'فشل Ahmose' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// 🚀 محاولة 7: استخدام Nekolabs API
const tryNekolabsBypass = async (url) => {
  try {
    // جلب الصفحة للحصول على siteKey
    const pageRes = await axios.get(url, { timeout: 10000 });
    const html = pageRes.data;
    const siteKey = extractSiteKey(html);
    
    if (siteKey) {
      const response = await axios.get(
        `https://api.nekolabs.web.id/tls/bypass/cf-turnstile?url=${encodeURIComponent(url)}&siteKey=${siteKey}`,
        { timeout: 30000 }
      );
      const result = response.data;
      
      if (result.success) {
        return { success: true, method: 'Nekolabs API', data: result };
      }
    }
    
    return { success: false, error: 'لم يتم العثور على siteKey' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// 🚀 محاولة 8: استخدام البروكسيات
const tryProxyBypass = async (url) => {
  for (const proxy of PROXIES) {
    try {
      const response = await axios.get(proxy + url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      if (response.status === 200) {
        const html = response.data;
        if (typeof html === 'string' && html.length > 500 && !html.includes('Just a moment')) {
          return { 
            success: true, 
            method: `Proxy: ${proxy}`, 
            data: { source: html, proxy } 
          };
        }
      }
    } catch (error) {
      continue;
    }
  }
  return { success: false, error: 'فشلت جميع البروكسيات' };
};

// 🎯 دالة التخطي الرئيسية
const bypassCloudflare = async (url) => {
  const methods = [
    { name: 'ZenCF API', fn: () => tryZencfBypass(url) },
    { name: 'CFTO API', fn: () => tryCftoApiBypass(url) },
    { name: 'CFTO WAF', fn: () => tryCftoWafBypass(url) },
    { name: 'CFTO Turnstile', fn: () => tryCftoTurnstileBypass(url) },
    { name: 'Hostrta', fn: () => tryHostrtaBypass(url) },
    { name: 'Ahmose', fn: () => tryAhmoseBypass(url) },
    { name: 'Nekolabs', fn: () => tryNekolabsBypass(url) },
    { name: 'Proxies', fn: () => tryProxyBypass(url) }
  ];

  let attempts = [];
  
  for (let i = 0; i < methods.length; i++) {
    const method = methods[i];
    
    try {
      const result = await method.fn();
      attempts.push({ method: method.name, ...result });
      
      if (result.success) {
        return {
          success: true,
          method: result.method,
          data: result.data,
          attempts: attempts
        };
      }
    } catch (error) {
      attempts.push({ method: method.name, success: false, error: error.message });
    }
  }

  return {
    success: false,
    message: 'فشلت جميع محاولات التخطي',
    attempts: attempts
  };
};

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ الرابط مطلوب (url)" 
      });
    }

    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ 
        status: false, 
        message: "❌ الرابط غير صالح" 
      });
    }

    const result = await bypassCloudflare(url);

    if (result.success) {
      const data = result.data;
      const html = data.source || data.html || '';
      const cookies = data.cookies || [];
      const headers = data.headers || {};
      const token = data.token || '';
      const statusCode = data.statusCode || data.status || 200;
      const finalUrl = data.finalUrl || data.url || url;

      const cookieText = Array.isArray(cookies) && cookies.length
        ? cookies.map(c => `${c.name}=${c.value}`).join("; ")
        : typeof cookies === 'object' && Object.keys(cookies).length
        ? Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
        : "";

      return res.json({
        status: true,
        message: "✅ تم تخطي الحماية بنجاح",
        method: result.method,
        url: finalUrl,
        statusCode: statusCode,
        pageSize: `${(html.length / 1024).toFixed(2)} KB`,
        cookiesCount: cookies.length || Object.keys(cookies).length || 0,
        cookies: cookieText || null,
        headers: headers,
        token: token || null,
        siteKey: data.siteKey || null,
        html: html,
        htmlPreview: html.slice(0, 3000),
        attempts: result.attempts
      });
    } else {
      return res.status(500).json({
        status: false,
        message: result.message,
        attempts: result.attempts
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء التخطي", 
      error: err.message 
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ الرابط مطلوب (url)",
        example: "?url=https://anime3rb.com"
      });
    }

    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ 
        status: false, 
        message: "❌ الرابط غير صالح" 
      });
    }

    const result = await bypassCloudflare(url);

    if (result.success) {
      const data = result.data;
      const html = data.source || data.html || '';
      const cookies = data.cookies || [];
      const headers = data.headers || {};
      const token = data.token || '';
      const statusCode = data.statusCode || data.status || 200;
      const finalUrl = data.finalUrl || data.url || url;

      const cookieText = Array.isArray(cookies) && cookies.length
        ? cookies.map(c => `${c.name}=${c.value}`).join("; ")
        : typeof cookies === 'object' && Object.keys(cookies).length
        ? Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
        : "";

      return res.json({
        status: true,
        message: "✅ تم تخطي الحماية بنجاح",
        method: result.method,
        url: finalUrl,
        statusCode: statusCode,
        pageSize: `${(html.length / 1024).toFixed(2)} KB`,
        cookiesCount: cookies.length || Object.keys(cookies).length || 0,
        cookies: cookieText || null,
        headers: headers,
        token: token || null,
        siteKey: data.siteKey || null,
        html: html,
        htmlPreview: html.slice(0, 3000),
        attempts: result.attempts
      });
    } else {
      return res.status(500).json({
        status: false,
        message: result.message,
        attempts: result.attempts
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء التخطي", 
      error: err.message 
    });
  }
});

export default router;