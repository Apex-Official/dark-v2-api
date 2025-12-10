import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

/**
 * 🔍 دالة البحث عن المانجا من الموقع
 */
async function searchManga(query) {
  const searchUrl = `https://mangatuk.com/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
  };

  const { data } = await axios.get(searchUrl, { headers });
  const $ = cheerio.load(data);

  const results = [];
  $(".c-tabs-item__content").each((i, el) => {
    if (i >= 10) return; // أول 10 نتائج فقط
    const title = $(el).find(".post-title a").text().trim();
    const link = $(el).find(".post-title a").attr("href");
    const img = $(el).find("img").attr("data-src");
    
    if (title && link) {
      results.push({ title, link, img });
    }
  });

  return results;
}

/**
 * 📝 POST Route - البحث عن مانجا
 */
router.post("/", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string" || query.trim() === "") {
      return res.status(400).json({
        status: false,
        message: "⚠️ برجاء إدخال اسم المانجا (query)",
      });
    }

    const results = await searchManga(query.trim());

    if (results.length === 0) {
      return res.status(404).json({
        status: false,
        message: `❌ لم يتم العثور على أي مانجا باسم: ${query}`,
        results: [],
      });
    }

    res.json({
      status: true,
      message: "✅ تم العثور على النتائج بنجاح",
      query: query,
      count: results.length,
      results: results,
    });
  } catch (err) {
    console.error("Error in POST /manga:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث عن المانجا",
      error: err.message,
    });
  }
});

/**
 * 🔍 GET Route - البحث عن مانجا
 */
router.get("/", async (req, res) => {
  try {
    const query = req.query.query || req.query.q;

    if (!query || typeof query !== "string" || query.trim() === "") {
      return res.status(400).json({
        status: false,
        message: "⚠️ برجاء إدخال اسم المانجا في query parameter (query أو q)",
        example: "/manga?query=سولو",
      });
    }

    const results = await searchManga(query.trim());

    if (results.length === 0) {
      return res.status(404).json({
        status: false,
        message: `❌ لم يتم العثور على أي مانجا باسم: ${query}`,
        results: [],
      });
    }

    res.json({
      status: true,
      message: "✅ تم العثور على النتائج بنجاح",
      query: query,
      count: results.length,
      results: results,
    });
  } catch (err) {
    console.error("Error in GET /manga:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء البحث عن المانجا",
      error: err.message,
    });
  }
});

export default router;