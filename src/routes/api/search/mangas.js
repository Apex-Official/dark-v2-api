import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

class SimpleMangaSearch {
  constructor() {
    this.baseUrl = "https://mangatuk.com";
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      Referer: "https://www.google.com/",
    };
  }

  async search(query, limit = 10) {
    if (!query || query.trim() === "") {
      throw new Error("اسم المانجا مطلوب للبحث");
    }

    const searchQuery = encodeURIComponent(query.trim());
    const searchUrl = `${this.baseUrl}/?s=${searchQuery}&post_type=wp-manga`;

    try {
      const { data } = await axios.get(searchUrl, {
        headers: this.headers,
        timeout: 15000,
      });

      const $ = cheerio.load(data);
      const results = [];

      $(".c-tabs-item__content").each((i, el) => {
        if (i >= limit) return false;

        const title = $(el).find(".post-title a").text().trim();
        const link = $(el).find(".post-title a").attr("href");

        if (title && link) {
          results.push({
            title,
            link,
          });
        }
      });

      if (results.length === 0) {
        throw new Error(`لم يتم العثور على أي نتائج لـ: ${query}`);
      }

      return results;
    } catch (error) {
      if (error.response) {
        throw new Error(`خطأ في الوصول للموقع: ${error.response.status}`);
      } else if (error.request) {
        throw new Error("فشل الاتصال بالموقع");
      } else {
        throw new Error(error.message || "خطأ غير معروف");
      }
    }
  }
}

/** GET Route - البحث البسيط */
router.get("/search", async (req, res) => {
  try {
    const { query, limit } = req.query;

    if (!query) {
      return res.status(400).json({
        status: false,
        message: "⚠️ اسم المانجا مطلوب (query)",
        example: "/manga/search?query=solo+leveling&limit=5",
      });
    }

    const searchLimit = limit ? parseInt(limit) : 10;
    const api = new SimpleMangaSearch();
    const results = await api.search(query, searchLimit);

    res.json({
      status: true,
      message: "✅ تم البحث بنجاح",
      query,
      totalResults: results.length,
      data: results,
    });
  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث",
      error: err.message,
    });
  }
});

/** POST Route - البحث البسيط */
router.post("/search", async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({
        status: false,
        message: "⚠️ اسم المانجا مطلوب (query)",
      });
    }

    const api = new SimpleMangaSearch();
    const results = await api.search(query, limit);

    res.json({
      status: true,
      message: "✅ تم البحث بنجاح",
      query,
      totalResults: results.length,
      data: results,
    });
  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث",
      error: err.message,
    });
  }
});

export default router;