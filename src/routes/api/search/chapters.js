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

class ManhwaChaptersAPI {
  async getChapters(manhwaUrl) {
    try {
      const res = await axios.get(manhwaUrl, { headers: DEFAULT_HEADERS, timeout: 15000 });
      const $ = cheerio.load(res.data);
      const chapters = [];

      const manhwaTitle = $('h1.entry-title, .post-title, .title, .wp-manga-title').first().text().trim() || 
                          $('title').text().trim();
      const manhwaThumb = $('.summary_image img, .tab-summary img, .manga-image img').first().attr('data-src') || 
                          $('.summary_image img, .tab-summary img, .manga-image img').first().attr('src') || 
                          DEFAULT_IMAGE;

      $('li.wp-manga-chapter a, .wp-manga-chapter a, .listing-chapters li a, a[href*="/chapter/"]').each((i, el) => {
        const a = $(el);
        const href = a.attr("href");
        const title = a.text().trim() || `الفصل ${i + 1}`;
        if (href && !chapters.find(c => c.url === href)) {
          chapters.push({ id: href, url: href, title });
        }
      });

      if (!chapters.length) {
        $('a').each((i, el) => {
          const href = $(el).attr("href") || "";
          if (/\/chapter\//.test(href)) {
            const title = $(el).text().trim() || `الفصل ${chapters.length + 1}`;
            if (!chapters.find(c => c.url === href)) {
              chapters.push({ id: href, url: href, title });
            }
          }
        });
      }

      return { 
        title: manhwaTitle || manhwaUrl, 
        chapters: chapters.reverse(), 
        thumb: manhwaThumb 
      };
    } catch (e) {
      console.error("getManhwaChapters error:", e?.message || e);
      throw new Error("فشل جلب فصول المانهوا");
    }
  }
}

/** 📚 POST Route - جلب فصول المانهوا */
router.post("/", async (req, res) => {
  try {
    const { manhwaUrl } = req.body;
    if (!manhwaUrl) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ الرجاء إدخال رابط المانهوا" 
      });
    }

    const api = new ManhwaChaptersAPI();
    const result = await api.getChapters(manhwaUrl);

    if (!result.chapters || !result.chapters.length) {
      return res.status(404).json({ 
        status: false, 
        message: "❌ لم يتم العثور على فصول لهذه المانهوا" 
      });
    }

    res.json({ 
      status: true, 
      message: `✅ تم العثور على ${result.chapters.length} فصل`, 
      data: result 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء جلب الفصول", 
      error: err.message 
    });
  }
});

/** 📚 GET Route - جلب فصول المانهوا */
router.get("/", async (req, res) => {
  try {
    const manhwaUrl = req.query.url;
    if (!manhwaUrl) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ الرجاء إدخال رابط المانهوا" 
      });
    }

    const api = new ManhwaChaptersAPI();
    const result = await api.getChapters(manhwaUrl);

    if (!result.chapters || !result.chapters.length) {
      return res.status(404).json({ 
        status: false, 
        message: "❌ لم يتم العثور على فصول لهذه المانهوا" 
      });
    }

    res.json({ 
      status: true, 
      message: `✅ تم العثور على ${result.chapters.length} فصل`, 
      data: result 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء جلب الفصول", 
      error: err.message 
    });
  }
});

export default router;