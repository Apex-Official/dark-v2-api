import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

/**
 * تهيئة هيدرز بسيطة وقريبة من طلب المتصفح لتجنب 403
 */
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
  Referer: "https://mangatuk.com/",
};

/**
 * دالة مساعدة لتحويل رابط نسبي إلى مطلق بناءً على صفحة المصدر
 */
function resolveUrl(base, href) {
  try {
    return new URL(href, base).href;
  } catch (e) {
    return href;
  }
}

/**
 * جلب روابط الفصول فقط من صفحة المانجا
 * @param {string} url رابط صفحة المانجا على mangatuk.com
 * @returns {Promise<Array<{id:number,title:string,link:string}>>}
 */
async function fetchChaptersOnly(url) {
  if (!url) throw new Error("رابط المانجا مطلوب");

  const axiosOptions = {
    headers: DEFAULT_HEADERS,
    timeout: 15000,
    maxRedirects: 5,
    responseType: "text",
    validateStatus: (status) => status >= 200 && status < 400,
  };

  const { data } = await axios.get(url, axiosOptions);
  const $ = cheerio.load(data);

  const chapters = [];
  $(".wp-manga-chapter a").each((i, el) => {
    const title = $(el).text().trim();
    let link = $(el).attr("href") || $(el).attr("data-href") || "";
    link = resolveUrl(url, link);

    if (title && link) {
      chapters.push({ id: i + 1, title, link });
    }
  });

  if (chapters.length === 0) {
    // جرب سيلكتور بديل إن اختلفت البنية في بعض الصفحات
    $(".chapter-list a, .chapters a").each((i, el) => {
      const title = $(el).text().trim();
      let link = $(el).attr("href") || $(el).attr("data-href") || "";
      link = resolveUrl(url, link);
      if (title && link) chapters.push({ id: chapters.length + 1, title, link });
    });
  }

  if (chapters.length === 0) {
    throw new Error("لم يتم العثور على أي فصول في هذا الرابط");
  }

  // ترتيب من الأقدم للأحدث (إذا كانت الصفحة تعرض الأحدث أولاً)
  return chapters.reverse();
}

/**
 * POST / - جلب الفصول (جسم الطلب: { url: "..." })
 */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== "string" || !url.trim()) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط المانجا مطلوب في body كـ { url }",
        example: { url: "https://mangatuk.com/manga/solo-leveling/" },
      });
    }

    const chapters = await fetchChaptersOnly(url.trim());

    res.json({
      status: true,
      message: "✅ تم جلب روابط الفصول بنجاح",
      totalChapters: chapters.length,
      chapters,
    });
  } catch (err) {
    console.error("❌ Error POST /manga:", err);
    // إذا كانت رسالة الخطأ رقمية (مثلاً 403) حاول أن تعطي حالة مناسبة
    if (err.message && err.message.includes("403")) {
      return res.status(403).json({
        status: false,
        message: "❌ تم حظر الطلب (403). جرّب تغيير الـ Referer أو User-Agent.",
        error: err.message,
      });
    }
    if (err.message && err.message.includes("لم يتم العثور")) {
      return res.status(404).json({
        status: false,
        message: err.message,
        chapters: [],
      });
    }
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء جلب الفصول",
      error: err.message || String(err),
    });
  }
});

/**
 * GET /?url=... - جلب الفصول عبر query param
 */
router.get("/", async (req, res) => {
  try {
    const url = req.query.url || req.query.u;
    if (!url || typeof url !== "string" || !url.trim()) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط المانجا مطلوب في query كـ ?url=",
        example: "/manga?url=https://mangatuk.com/manga/solo-leveling/",
      });
    }

    const chapters = await fetchChaptersOnly(url.trim());

    res.json({
      status: true,
      message: "✅ تم جلب روابط الفصول بنجاح",
      totalChapters: chapters.length,
      chapters,
    });
  } catch (err) {
    console.error("❌ Error GET /manga:", err);
    if (err.message && err.message.includes("403")) {
      return res.status(403).json({
        status: false,
        message: "❌ تم حظر الطلب (403). جرّب تغيير الـ Referer أو User-Agent.",
        error: err.message,
      });
    }
    if (err.message && err.message.includes("لم يتم العثور")) {
      return res.status(404).json({
        status: false,
        message: err.message,
        chapters: [],
      });
    }
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء جلب الفصول",
      error: err.message || String(err),
    });
  }
});

export default router;