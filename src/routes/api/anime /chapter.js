import express from "express";
import axios from "axios";

const router = express.Router();

class MangaChapterAPI {
  constructor() {
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
      Referer: "https://www.google.com/",
    };
  }

  /**
   * استخراج صور الفصل من CSS
   * @param {string} url - رابط صفحة الفصل
   * @returns {Promise<Array>} قائمة روابط الصور
   */
  async getChapterImages(url) {
    if (!url) throw new Error("رابط الفصل مطلوب");

    try {
      const { data } = await axios.get(url, {
        headers: this.headers,
        timeout: 20000,
      });

      // استخراج كل روابط الصور من CSS
      const regex = /background-image:\s*url\(['"]?(.*?)['"]?\)/g;
      let match;
      const images = [];

      while ((match = regex.exec(data)) !== null) {
        if (match[1]) {
          images.push(match[1]);
        }
      }

      if (images.length === 0) {
        throw new Error("لم يتم العثور على صور في هذا الفصل");
      }

      // ترتيب الصور حسب الرقم
      images.sort((a, b) => {
        const getNum = (url) => parseInt(url.match(/image-(\d+)\.webp$/)?.[1] || 0);
        return getNum(a) - getNum(b);
      });

      return images;
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
   * فحص صلاحية رابط الصورة
   * @param {string} imageUrl - رابط الصورة
   * @returns {Promise<boolean>}
   */
  async validateImage(imageUrl) {
    try {
      const response = await axios.head(imageUrl, {
        timeout: 5000,
        validateStatus: (status) => status < 500,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * جلب الصور مع التحقق من الصلاحية
   * @param {string} url - رابط صفحة الفصل
   * @param {boolean} validate - التحقق من صلاحية الصور
   * @returns {Promise<Object>}
   */
  async getChapterData(url, validate = false) {
    const images = await this.getChapterImages(url);
    
    let validImages = images;
    
    if (validate) {
      // التحقق من صلاحية كل صورة
      const validationPromises = images.map(async (img) => {
        const isValid = await this.validateImage(img);
        return { url: img, valid: isValid };
      });

      const results = await Promise.all(validationPromises);
      validImages = results.filter((r) => r.valid).map((r) => r.url);

      if (validImages.length === 0) {
        throw new Error("جميع روابط الصور غير صالحة");
      }
    }

    return {
      totalImages: images.length,
      validImages: validImages.length,
      images: validImages.map((img, index) => ({
        page: index + 1,
        url: img,
      })),
    };
  }
}

/** 🧩 POST Route - جلب صور الفصل */
router.post("/", async (req, res) => {
  try {
    const { url, validate = false, pageRange } = req.body;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الفصل مطلوب (url)",
      });
    }

    const scraper = new MangaChapterAPI();
    const result = await scraper.getChapterData(url, validate);

    // إذا طلب المستخدم صفحات محددة
    let images = result.images;
    if (pageRange && typeof pageRange === "object") {
      const { start, end } = pageRange;
      if (start && end) {
        images = images.slice(start - 1, end);
      }
    }

    res.json({
      status: true,
      message: "✅ تم جلب صور الفصل بنجاح",
      totalPages: result.totalImages,
      validPages: result.validImages,
      returnedPages: images.length,
      data: images,
    });
  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء جلب صور الفصل",
      error: err.message,
    });
  }
});

/** 🧩 GET Route - جلب صور الفصل */
router.get("/", async (req, res) => {
  try {
    const { url, validate, start, end } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الفصل مطلوب (url)",
        example: "/chapter?url=https://mangatuk.com/manga/solo-leveling/chapter-1/",
      });
    }

    const scraper = new MangaChapterAPI();
    const result = await scraper.getChapterData(url, validate === "true");

    // إذا طلب المستخدم صفحات محددة
    let images = result.images;
    if (start && end) {
      const startPage = parseInt(start);
      const endPage = parseInt(end);
      
      if (!isNaN(startPage) && !isNaN(endPage)) {
        images = images.slice(startPage - 1, endPage);
      }
    }

    res.json({
      status: true,
      message: "✅ تم جلب صور الفصل بنجاح",
      totalPages: result.totalImages,
      validPages: result.validImages,
      returnedPages: images.length,
      data: images,
    });
  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء جلب صور الفصل",
      error: err.message,
    });
  }
});

/** 🧩 GET Route - جلب صورة واحدة من الفصل */
router.get("/page/:pageNumber", async (req, res) => {
  try {
    const { url } = req.query;
    const { pageNumber } = req.params;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الفصل مطلوب (url)",
      });
    }

    const page = parseInt(pageNumber);
    if (isNaN(page) || page < 1) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رقم الصفحة غير صحيح",
      });
    }

    const scraper = new MangaChapterAPI();
    const result = await scraper.getChapterData(url, false);

    if (page > result.images.length) {
      return res.status(404).json({
        status: false,
        message: `⚠️ الصفحة ${page} غير موجودة. العدد الكلي: ${result.images.length}`,
      });
    }

    res.json({
      status: true,
      message: "✅ تم جلب الصفحة بنجاح",
      data: result.images[page - 1],
    });
  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء جلب الصفحة",
      error: err.message,
    });
  }
});

/** 🧩 GET Route - عدد صفحات الفصل فقط */
router.get("/count", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الفصل مطلوب (url)",
      });
    }

    const scraper = new MangaChapterAPI();
    const images = await scraper.getChapterImages(url);

    res.json({
      status: true,
      message: "✅ تم حساب عدد الصفحات",
      totalPages: images.length,
    });
  } catch (err) {
    console.error("❌ خطأ:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء حساب الصفحات",
      error: err.message,
    });
  }
});

export default router;