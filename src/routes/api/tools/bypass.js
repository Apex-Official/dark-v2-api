import express from "express";
import fetch from "node-fetch";
import axios from "axios";
import cheerio from "cheerio";
import { zencf } from "zencf";

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

// 🔧 دوال المساعدة
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 🚀 طرق التخطي
const bypassMethods = {
  // الطريقة 1: ZenCF (الأساسية)
  async zencfSource(url) {
    try {
      const result = await zencf.source(url);
      if (result && result.source) {
        return { 
          success: true, 
          html: result.source, 
          cookies: result.cookies || [], 
          headers: result.headers || {},
          statusCode: result.statusCode,
          finalUrl: result.finalUrl || url
        };
      }
    } catch (e) {
      console.error("ZenCF error:", e.message);
    }
    return null;
  },

  // الطريقة 2: CFTO API Source
  async cftoSource(url, proxy) {
    try {
      const response = await fetch("https://cf.pitucode.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "source", url, proxy })
      });
      const data = await response.json();
      if (data.source) return { success: true, html: data.source, cookies: data.cookies, headers: data.headers };
    } catch (e) {
      console.error("CFTO Source error:", e.message);
    }
    return null;
  },

  // الطريقة 3: CFTO WAF Session
  async cftoWafSession(url, proxy) {
    try {
      const response = await fetch("https://cf.pitucode.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "waf-session", url, proxy })
      });
      const data = await response.json();
      if (data.cookies) {
        const html = await fetch(url, {
          headers: { Cookie: data.cookies.map(c => `${c.name}=${c.value}`).join("; ") }
        }).then(r => r.text());
        return { success: true, html, cookies: data.cookies };
      }
    } catch (e) {
      console.error("CFTO WAF error:", e.message);
    }
    return null;
  },

  // الطريقة 4: Hostrta Bypass
  async hostrtaBypass(url) {
    try {
      const response = await fetch(`https://key.hostrta.win/api/analyze?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (data.html || data.content) return { success: true, html: data.html || data.content };
    } catch (e) {
      console.error("Hostrta error:", e.message);
    }
    return null;
  },

  // الطريقة 5: Ahmose API
  async ahmoseBypass(url) {
    try {
      const response = await fetch(`https://ahmoseapi.loca.lt/api/bypass/source?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (data.html || data.source) return { success: true, html: data.html || data.source };
    } catch (e) {
      console.error("Ahmose error:", e.message);
    }
    return null;
  },

  // الطريقة 6: Nekolabs TLS
  async nekolabsBypass(url, siteKey) {
    try {
      const apiUrl = siteKey 
        ? `https://api.nekolabs.web.id/tls/bypass/cf-turnstile?url=${encodeURIComponent(url)}&siteKey=${siteKey}`
        : `https://api.nekolabs.web.id/tls/bypass/cf-turnstile?url=${encodeURIComponent(url)}`;
      const response = await fetch(apiUrl);
      const data = await response.json();
      if (data.html || data.content) return { success: true, html: data.html || data.content };
    } catch (e) {
      console.error("Nekolabs error:", e.message);
    }
    return null;
  },

  // الطريقة 7: Scrape.do
  async scrapeDo(url) {
    try {
      const token = "69c59f0ca5f942b580c0a03606a1b90c1978645d2bb";
      const targetUrl = encodeURIComponent(url);
      
      const config = {
        method: "GET",
        url: `https://api.scrape.do/?token=${token}&url=${targetUrl}&render=true`,
        headers: {},
      };

      const response = await axios(config);
      
      if (response.status === 200 && response.data) {
        const $ = cheerio.load(response.data);
        const h2 = $("h2").first().text().trim();
        const h3 = $("h3").first().text().trim();
        
        return { 
          success: true, 
          html: response.data,
          statusCode: response.status,
          h2: h2 || null,
          h3: h3 || null
        };
      }
    } catch (e) {
      console.error("Scrape.do error:", e.message);
    }
    return null;
  },

  // الطريقة 8: البروكسيات المباشرة
  async proxyBypass(url) {
    for (const proxy of PROXIES) {
      try {
        const response = await fetch(proxy + url, { timeout: 10000 });
        if (response.ok) {
          const html = await response.text();
          if (html && html.length > 500) return { success: true, html };
        }
      } catch (e) {
        // استمر للبروكسي التالي
      }
    }
    return null;
  },

  // الطريقة 9: Fetch مباشر
  async directFetch(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      if (response.ok) {
        const html = await response.text();
        if (html && !html.includes('Just a moment')) return { success: true, html };
      }
    } catch (e) {
      console.error("Direct fetch error:", e.message);
    }
    return null;
  }
};

// 🔄 دالة التخطي الرئيسية
async function bypassCloudflare(url) {
  const methods = [
    { name: "ZenCF", fn: () => bypassMethods.zencfSource(url) },
    { name: "CFTO Source", fn: () => bypassMethods.cftoSource(url) },
    { name: "CFTO WAF", fn: () => bypassMethods.cftoWafSession(url) },
    { name: "Hostrta", fn: () => bypassMethods.hostrtaBypass(url) },
    { name: "Ahmose", fn: () => bypassMethods.ahmoseBypass(url) },
    { name: "Nekolabs", fn: () => bypassMethods.nekolabsBypass(url) },
    { name: "Scrape.do", fn: () => bypassMethods.scrapeDo(url) },
    { name: "Proxy", fn: () => bypassMethods.proxyBypass(url) },
    { name: "Direct", fn: () => bypassMethods.directFetch(url) }
  ];

  for (const method of methods) {
    try {
      const result = await method.fn();
      
      if (result && result.success && result.html) {
        return {
          success: true,
          method: method.name,
          data: result
        };
      }
    } catch (err) {
      console.error(`فشل ${method.name}:`, err.message);
    }
    
    await sleep(500);
  }

  return { success: false, message: "فشلت جميع الطرق" };
}

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

    if (!result.success) {
      return res.status(500).json({
        status: false,
        message: "❌ فشل التخطي - تم تجربة جميع الطرق المتاحة"
      });
    }

    const { html, cookies = [], headers = {}, statusCode = "N/A", finalUrl = url } = result.data;
    
    // استخراج بيانات إضافية
    const $ = cheerio.load(html);
    const title = $("title").text().trim() || "بدون عنوان";
    const h1 = $("h1").first().text().trim();
    const h2 = result.data.h2 || $("h2").first().text().trim();
    const h3 = result.data.h3 || $("h3").first().text().trim();

    res.json({
      status: true,
      message: "✅ تم التخطي بنجاح",
      method: result.method,
      data: {
        url: finalUrl,
        statusCode,
        size: `${(html.length / 1024).toFixed(2)} KB`,
        title,
        h1: h1 || null,
        h2: h2 || null,
        h3: h3 || null,
        cookies: cookies.map(c => ({ name: c.name, value: c.value })),
        cookiesCount: cookies.length,
        headers: Object.fromEntries(Object.entries(headers).slice(0, 10)),
        htmlPreview: html.slice(0, 3000) + (html.length > 3000 ? '...' : ''),
        fullHtml: html // الكود الكامل
      }
    });

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

    if (!result.success) {
      return res.status(500).json({
        status: false,
        message: "❌ فشل التخطي - تم تجربة جميع الطرق المتاحة"
      });
    }

    const { html, cookies = [], headers = {}, statusCode = "N/A", finalUrl = url } = result.data;
    
    // استخراج بيانات إضافية
    const $ = cheerio.load(html);
    const title = $("title").text().trim() || "بدون عنوان";
    const h1 = $("h1").first().text().trim();
    const h2 = result.data.h2 || $("h2").first().text().trim();
    const h3 = result.data.h3 || $("h3").first().text().trim();

    res.json({
      status: true,
      message: "✅ تم التخطي بنجاح",
      method: result.method,
      data: {
        url: finalUrl,
        statusCode,
        size: `${(html.length / 1024).toFixed(2)} KB`,
        title,
        h1: h1 || null,
        h2: h2 || null,
        h3: h3 || null,
        cookies: cookies.map(c => ({ name: c.name, value: c.value })),
        cookiesCount: cookies.length,
        headers: Object.fromEntries(Object.entries(headers).slice(0, 10)),
        htmlPreview: html.slice(0, 3000) + (html.length > 3000 ? '...' : ''),
        fullHtml: html // الكود الكامل
      }
    });

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