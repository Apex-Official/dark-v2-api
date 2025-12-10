import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

class MangaScraperAPI {
  constructor() {
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Cache-Control": "max-age=0",
      Referer: "https://www.google.com/",
    };
  }

  /**
   * جلب فصول المانجا من الرابط
   * @param {string} url - رابط صفحة المانجا
   * @returns {Promise<Array>} قائمة الفصول
   */
  async getChapters(url) {
    if (!url) throw new Error("رابط المانجا مطلوب");

    try {
      const { data } = await axios.get(url, {
        headers: this.headers,
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        },
      });

      const $ = cheerio.load(data);
      let chapters = [];

      $(".wp-manga-chapter a").each((i, el) => {
        let title = $(el).text().trim();
        let link = $(el).attr("href");
        if (title && link) {
          chapters.push({
            id: i + 1,
            title,
            link,
          });
        }
      });

      if (chapters.length === 0) {
        throw new Error("لم يتم العثور على أي فصول في هذا الرابط");
      }

      // ترتيب الفصول من الأقدم للأحدث
      return chapters.reverse();
    } catch (error) {
      if (error.response) {
        throw new Error(`خطأ في الوصول للموقع: ${error.response.status}`);
      } else if (error.request) {
        throw new Error("فشل الاتصال بالموقع، تحقق من الرابط");
      } else {
        throw new Error(error.message || "خطأ غير معروف");
      }
    }
  }

  /**
   * جلب معلومات المانجا الأساسية
   * @param {string} url - رابط صفحة المانجا
   * @returns {Promise<Object>} معلومات المانجا
   */
  async getMangaInfo(url) {
    try {
      const { data } = await axios.get(url, {
        headers: this.headers,
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        },
      });

      const $ = cheerio.load(data);

      const title = $(".post-title h1").text().trim() || "غير معروف";
      const cover = $(".summary_image img").attr("src") || null;
      const description =
        $(".summary__content p").text().trim() || "لا يوجد وصف";
      const author = $(".author-content a").text().trim() || "غير معروف";
      const status = $(".summary-content").last().text().trim() || "غير معروف";

      return {
        title,
        cover,
        description,
        author,
        status,
      };
    } catch (error) {
      console.error("خطأ في جلب معلومات المانجا:", error.message);
      return null;
    }
  }
}

/** 🧩 POST Route - جلب الفصول */
router.post("/", async (req, res) => {
  try {
    const { url, includeInfo = false } = req.body;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط المانجا مطلوب (url)",
      });
    }

    const scraper = new MangaScraperAPI();
    const chapters = await scraper.getChapters(url);

    let response = {
      status: true,
      message: "✅ تم جلب الفصول بنجاح",
      totalChapters: chapters.length,
      chapters,
    };

    // إذا طلب المستخدم معلومات المانجا أيضاً
    if (includeInfo) {
      const info = await scraper.getMangaInfo(url);
      if (info) response.mangaInfo = info;
    }

    res.json(response);
  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء جلب الفصول",
      error: err.message,
    });
  }
});

/** 🧩 GET Route - جلب الفصول */
router.get("/", async (req, res) => {
  try {
    const { url, includeInfo } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط المانجا مطلوب (url)",
        example: "/manga?url=https://mangatuk.com/manga/solo-leveling/",
      });
    }

    const scraper = new MangaScraperAPI();
    const chapters = await scraper.getChapters(url);

    let response = {
      status: true,
      message: "✅ تم جلب الفصول بنجاح",
      totalChapters: chapters.length,
      chapters,
    };

    // إذا طلب المستخدم معلومات المانجا أيضاً
    if (includeInfo === "true") {
      const info = await scraper.getMangaInfo(url);
      if (info) response.mangaInfo = info;
    }

    res.json(response);
  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء جلب الفصول",
      error: err.message,
    });
  }
});

/** 🧩 GET Route - جلب معلومات المانجا فقط */
router.get("/info", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط المانجا مطلوب (url)",
        example: "/manga/info?url=https://mangatuk.com/manga/solo-leveling/",
      });
    }

    const scraper = new MangaScraperAPI();
    const info = await scraper.getMangaInfo(url);

    if (!info) {
      return res.status(404).json({
        status: false,
        message: "❌ لم يتم العثور على معلومات المانجا",
      });
    }

    res.json({
      status: true,
      message: "✅ تم جلب معلومات المانجا بنجاح",
      data: info,
    });
  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء جلب المعلومات",
      error: err.message,
    });
  }
});

export default router;