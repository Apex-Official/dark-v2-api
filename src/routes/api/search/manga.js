import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

const DEFAULT_IMAGE = "https://i.postimg.cc/7C2CkQgg/upload-1765096325940.jpg";

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 14; 22120RN86G) AppleWebKit/537.36 Chrome/141.0.7390.122 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": "https://azoramoon.com/"
};

class ManhwaSearchAPI {
  async search(query) {
    try {
      const url = `https://azoramoon.com/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
      const res = await axios.get(url, { headers: DEFAULT_HEADERS, timeout: 15000 });
      const $ = cheerio.load(res.data);
      const results = [];

      $('article a[href*="/series/"], .manga a[href*="/series/"], a[href*="/series/"]').each((i, el) => {
        if (i >= 10) return;
        const a = $(el);
        const href = a.attr("href");
        const title = (a.attr("title") || a.text() || "").trim();
        let thumb = a.find("img").attr("data-src") || a.find("img").attr("src") || 
                    a.closest("article").find("img").attr("data-src") || 
                    a.closest("article").find("img").attr("src") || DEFAULT_IMAGE;
        
        if (href && title && !results.find(r => r.url === href)) {
          results.push({ id: href, url: href, title, thumb });
        }
      });

      if (!results.length) {
        $(".post, .listing, .manga, .bs, .bsx").each((i, el) => {
          const a = cheerio.load(el)("a").first();
          const href = a.attr("href");
          const title = a.attr("title") || a.text() || "";
          const thumb = cheerio.load(el)("img").attr("data-src") || 
                       cheerio.load(el)("img").attr("src") || DEFAULT_IMAGE;
          if (href && title && !results.find(r => r.url === href)) {
            results.push({ id: href, url: href, title: title.trim(), thumb });
          }
        });
      }

      return results.slice(0, 10);
    } catch (e) {
      console.error("searchManhwa error:", e?.message || e);
      throw new Error("فشل البحث عن المانهوا");
    }
  }
}

/** 🔍 POST Route - البحث عن المانهوا */
router.post("/", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ الرجاء إدخال اسم المانهوا للبحث" 
      });
    }

    const api = new ManhwaSearchAPI();
    const results = await api.search(query);

    if (!results || !results.length) {
      return res.status(404).json({ 
        status: false, 
        message: "❌ لم يتم العثور على نتائج" 
      });
    }

    res.json({ 
      status: true, 
      message: `✅ تم العثور على ${results.length} نتيجة`, 
      data: results 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء البحث", 
      error: err.message 
    });
  }
});

/** 🔍 GET Route - البحث عن المانهوا */
router.get("/", async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ الرجاء إدخال اسم المانهوا للبحث" 
      });
    }

    const api = new ManhwaSearchAPI();
    const results = await api.search(query);

    if (!results || !results.length) {
      return res.status(404).json({ 
        status: false, 
        message: "❌ لم يتم العثور على نتائج" 
      });
    }

    res.json({ 
      status: true, 
      message: `✅ تم العثور على ${results.length} نتيجة`, 
      data: results 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء البحث", 
      error: err.message 
    });
  }
});

export default router;