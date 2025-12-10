import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import PDFDocument from "pdfkit";

const router = express.Router();

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 14; 22120RN86G) AppleWebKit/537.36 Chrome/141.0.7390.122 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar,en-GB;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": "https://azoramoon.com/"
};

class ManhwaPDFAPI {
  async getChapterImages(chapterUrl) {
    try {
      const res = await axios.get(chapterUrl, { headers: DEFAULT_HEADERS, timeout: 20000 });
      const $ = cheerio.load(res.data);
      const imgs = [];

      $('.reading-content img, img.wp-manga-chapter-img').each((i, el) => {
        const src = $(el).attr("data-src") || $(el).attr("data-lazy-src") || 
                    $(el).attr("src") || $(el).attr("data-original");
        if (src && !imgs.includes(src)) imgs.push(src);
      });

      const normalized = imgs.map(u => 
        (u && u.startsWith("http")) ? u : (u ? new URL(u, chapterUrl).href : u)
      ).filter(Boolean);
      
      return normalized;
    } catch (e) {
      console.error("getChapterImages error:", e?.message || e);
      throw new Error("فشل جلب صور الفصل");
    }
  }

  async createPDF(chapterUrl, chapterTitle) {
    try {
      const images = await this.getChapterImages(chapterUrl);
      if (!images || !images.length) throw new Error("لم يتم العثور على صور للفصل");

      const doc = new PDFDocument({ autoFirstPage: false, compress: true });
      const chunks = [];
      
      doc.on("data", (c) => chunks.push(c));
      
      const endPromise = new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err) => reject(err));
      });

      for (let i = 0; i < images.length; i++) {
        try {
          const imgUrl = images[i];
          const resp = await axios.get(imgUrl, { 
            responseType: "arraybuffer", 
            headers: { Referer: chapterUrl, ...DEFAULT_HEADERS }, 
            timeout: 20000 
          });
          const imgBuf = Buffer.from(resp.data);

          doc.addPage({ size: "A4", margin: 0 });
          try {
            doc.image(imgBuf, 0, 0, { 
              fit: [595.28, 841.89], 
              align: "center", 
              valign: "center" 
            });
          } catch (e) {
            doc.fontSize(12).text(
              `صورة ${i + 1} لا يمكن عرضها داخل ملف PDF.`, 
              25, 25, 
              { width: 545 }
            );
          }
        } catch (errImg) {
          console.warn("image fetch error:", errImg?.message || errImg);
          doc.addPage({ size: "A4", margin: 40 });
          doc.fontSize(12).text(`تعذر تحميل صورة ${i + 1}.`, { align: "left" });
        }
      }

      doc.end();
      const pdfBuffer = await endPromise;
      return pdfBuffer;
    } catch (e) {
      console.error("createPDF error:", e?.message || e);
      throw new Error("فشل إنشاء ملف PDF");
    }
  }
}

/** 📄 POST Route - تحميل الفصل كـ PDF */
router.post("/", async (req, res) => {
  try {
    const { chapterUrl, chapterTitle = "chapter" } = req.body;
    if (!chapterUrl) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ الرجاء إدخال رابط الفصل" 
      });
    }

    const api = new ManhwaPDFAPI();
    const pdfBuffer = await api.createPDF(chapterUrl, chapterTitle);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${chapterTitle}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء إنشاء ملف PDF", 
      error: err.message 
    });
  }
});

/** 📄 GET Route - تحميل الفصل كـ PDF */
router.get("/", async (req, res) => {
  try {
    const chapterUrl = req.query.url;
    const chapterTitle = req.query.title || "chapter";
    
    if (!chapterUrl) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ الرجاء إدخال رابط الفصل" 
      });
    }

    const api = new ManhwaPDFAPI();
    const pdfBuffer = await api.createPDF(chapterUrl, chapterTitle);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${chapterTitle}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء إنشاء ملف PDF", 
      error: err.message 
    });
  }
});

export default router;