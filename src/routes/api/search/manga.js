import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

class MangaSearchAPI {
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

  /**
   * البحث عن مانجا
   * @param {string} query - اسم المانجا للبحث
   * @param {number} limit - عدد النتائج المطلوبة (افتراضي: 10)
   * @returns {Promise<Array>} قائمة نتائج البحث
   */
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
        if (i >= limit) return false; // إيقاف بعد الحد المطلوب

        const title = $(el).find(".post-title a").text().trim();
        const link = $(el).find(".post-title a").attr("href");
        const img = $(el).find("img").attr("data-src") || $(el).find("img").attr("src");
        const latest = $(el).find(".latest-chap .chapter a").text().trim();
        const rating = $(el).find(".post-total-rating .score").text().trim();
        const status = $(el).find(".mg_status .summary-content").text().trim();

        if (title && link) {
          results.push({
            id: i + 1,
            title,
            link,
            image: img || null,
            latestChapter: latest || "غير متوفر",
            rating: rating || "N/A",
            status: status || "غير معروف",
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

  /**
   * الحصول على تفاصيل مانجا محددة
   * @param {string} url - رابط صفحة المانجا
   * @returns {Promise<Object>} تفاصيل المانجا
   */
  async getDetails(url) {
    try {
      const { data } = await axios.get(url, {
        headers: this.headers,
        timeout: 15000,
      });

      const $ = cheerio.load(data);

      const title = $(".post-title h1").text().trim() || "غير معروف";
      const coverImage = $(".summary_image img").attr("data-src") || $(".summary_image img").attr("src");
      const rating = $(".post-total-rating .score").text().trim();
      const description = $(".summary__content p").text().trim();
      const author = $(".author-content a").text().trim();
      const artist = $(".artist-content a").text().trim();
      const status = $(".post-status .summary-content").text().trim();
      const releaseYear = $(".post-content_item:contains('Release')").find(".summary-content").text().trim();

      const genres = [];
      $(".genres-content a").each((i, el) => {
        genres.push($(el).text().trim());
      });

      const alternativeTitles = [];
      $(".post-content_item:contains('Alternative')").find(".summary-content").text().split(";").forEach(alt => {
        const trimmed = alt.trim();
        if (trimmed) alternativeTitles.push(trimmed);
      });

      return {
        title,
        alternativeTitles,
        coverImage: coverImage || null,
        rating: rating || "N/A",
        description: description || "لا يوجد وصف",
        author: author || "غير معروف",
        artist: artist || "غير معروف",
        status: status || "غير معروف",
        releaseYear: releaseYear || "غير معروف",
        genres: genres.length > 0 ? genres : ["غير محدد"],
        url,
      };
    } catch (error) {
      throw new Error("فشل الحصول على تفاصيل المانجا");
    }
  }

  /**
   * البحث المتقدم مع الفلترة
   * @param {Object} options - خيارات البحث
   * @returns {Promise<Array>}
   */
  async advancedSearch({ query, minRating = 0, status = null, limit = 10 }) {
    const results = await this.search(query, limit * 2); // جلب ضعف العدد للفلترة

    let filtered = results;

    // فلترة حسب التقييم
    if (minRating > 0) {
      filtered = filtered.filter((m) => {
        const rating = parseFloat(m.rating);
        return !isNaN(rating) && rating >= minRating;
      });
    }

    // فلترة حسب الحالة
    if (status) {
      const statusLower = status.toLowerCase();
      filtered = filtered.filter((m) =>
        m.status.toLowerCase().includes(statusLower)
      );
    }

    return filtered.slice(0, limit);
  }
}

/** 🧩 POST Route - البحث عن مانجا */
router.post("/search", async (req, res) => {
  try {
    const { query, limit = 10, detailed = false } = req.body;

    if (!query) {
      return res.status(400).json({
        status: false,
        message: "⚠️ اسم المانجا مطلوب (query)",
      });
    }

    const api = new MangaSearchAPI();
    const results = await api.search(query, limit);

    // إذا طلب المستخدم تفاصيل كاملة
    if (detailed && results.length > 0) {
      const detailedResults = await Promise.all(
        results.slice(0, 3).map(async (manga) => {
          try {
            const details = await api.getDetails(manga.link);
            return { ...manga, details };
          } catch {
            return manga;
          }
        })
      );

      return res.json({
        status: true,
        message: "✅ تم البحث بنجاح مع التفاصيل",
        query,
        totalResults: results.length,
        data: detailedResults,
      });
    }

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

/** 🧩 GET Route - البحث عن مانجا */
router.get("/search", async (req, res) => {
  try {
    const { query, limit, detailed } = req.query;

    if (!query) {
      return res.status(400).json({
        status: false,
        message: "⚠️ اسم المانجا مطلوب (query)",
        example: "/manga/search?query=solo+leveling&limit=5",
      });
    }

    const searchLimit = limit ? parseInt(limit) : 10;
    const api = new MangaSearchAPI();
    const results = await api.search(query, searchLimit);

    // إذا طلب المستخدم تفاصيل كاملة
    if (detailed === "true" && results.length > 0) {
      const detailedResults = await Promise.all(
        results.slice(0, 3).map(async (manga) => {
          try {
            const details = await api.getDetails(manga.link);
            return { ...manga, details };
          } catch {
            return manga;
          }
        })
      );

      return res.json({
        status: true,
        message: "✅ تم البحث بنجاح مع التفاصيل",
        query,
        totalResults: results.length,
        data: detailedResults,
      });
    }

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

/** 🧩 GET Route - تفاصيل مانجا محددة */
router.get("/details", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط المانجا مطلوب (url)",
      });
    }

    const api = new MangaSearchAPI();
    const details = await api.getDetails(url);

    res.json({
      status: true,
      message: "✅ تم الحصول على التفاصيل بنجاح",
      data: details,
    });
  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء جلب التفاصيل",
      error: err.message,
    });
  }
});

/** 🧩 POST Route - البحث المتقدم */
router.post("/advanced-search", async (req, res) => {
  try {
    const { query, minRating, status, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({
        status: false,
        message: "⚠️ اسم المانجا مطلوب (query)",
      });
    }

    const api = new MangaSearchAPI();
    const results = await api.advancedSearch({
      query,
      minRating: minRating ? parseFloat(minRating) : 0,
      status,
      limit,
    });

    res.json({
      status: true,
      message: "✅ تم البحث المتقدم بنجاح",
      query,
      filters: {
        minRating: minRating || "none",
        status: status || "all",
      },
      totalResults: results.length,
      data: results,
    });
  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث المتقدم",
      error: err.message,
    });
  }
});

/** 🧩 GET Route - اقتراحات سريعة */
router.get("/suggestions", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يجب إدخال حرفين على الأقل",
      });
    }

    const api = new MangaSearchAPI();
    const results = await api.search(query, 5);

    // إرجاع عناوين فقط للاقتراحات
    const suggestions = results.map((r) => ({
      title: r.title,
      link: r.link,
      image: r.image,
    }));

    res.json({
      status: true,
      message: "✅ اقتراحات متاحة",
      query,
      data: suggestions,
    });
  } catch (err) {
    res.json({
      status: false,
      message: "لا توجد اقتراحات",
      data: [],
    });
  }
});

export default router;