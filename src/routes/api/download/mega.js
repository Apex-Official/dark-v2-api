import express from "express";
import { File } from "megajs";
import path from "path";

const router = express.Router();

class MegaDownloader {
  constructor() {
    this.maxFileSize = 300000000; // 300 MB
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 بايت';
    const k = 1024;
    const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'غيغابايت', 'تيرابايت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getMimeType(filename) {
    const fileExtension = path.extname(filename).toLowerCase();
    const mimeTypes = {
      ".mp4": "video/mp4",
      ".pdf": "application/pdf",
      ".zip": "application/zip",
      ".rar": "application/x-rar-compressed",
      ".7z": "application/x-7z-compressed",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
    };
    return mimeTypes[fileExtension] || "application/octet-stream";
  }

  validateUrl(url) {
    // التحقق من صحة رابط Mega
    const megaRegex = /mega\.nz\/(file|folder)\/[a-zA-Z0-9_-]+#[a-zA-Z0-9_-]+/;
    if (!megaRegex.test(url)) {
      throw new Error("رابط Mega غير صالح. يجب أن يحتوي على hash (#). مثال: https://mega.nz/file/xxxxx#yyyyy");
    }
  }

  async download(url) {
    if (!url) throw new Error("رابط Mega مطلوب");

    // التحقق من صحة الرابط
    this.validateUrl(url);

    const file = File.fromURL(url);
    await file.loadAttributes();

    if (file.size >= this.maxFileSize) {
      throw new Error(`حجم الملف كبير جداً (الحد الأقصى: ${this.formatBytes(this.maxFileSize)})`);
    }

    const data = await file.downloadBuffer();
    const mimetype = this.getMimeType(file.name);

    return {
      buffer: data,
      name: file.name,
      size: file.size,
      sizeFormatted: this.formatBytes(file.size),
      mimetype,
    };
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ رابط Mega مطلوب (url)",
        example: "https://mega.nz/file/ovJTHaQZ#yAbkrvQgykcH_NDKQ8eIc0zvsN7jonBbHZ_HTQL6lZ8"
      });
    }

    const downloader = new MegaDownloader();
    const result = await downloader.download(url);

    res.json({
      status: true,
      message: "✅ تم تنزيل الملف بنجاح",
      file: {
        name: result.name,
        size: result.sizeFormatted,
        mimetype: result.mimetype,
      },
      data: result.buffer.toString('base64'),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء تنزيل الملف من Mega", 
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
        message: "⚠️ رابط Mega مطلوب (url)",
        example: "https://mega.nz/file/ovJTHaQZ#yAbkrvQgykcH_NDKQ8eIc0zvsN7jonBbHZ_HTQL6lZ8"
      });
    }

    const downloader = new MegaDownloader();
    const result = await downloader.download(url);

    res.setHeader('Content-Type', result.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${result.name}"`);
    res.setHeader('Content-Length', result.size);

    res.send(result.buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ أثناء تنزيل الملف من Mega", 
      error: err.message 
    });
  }
});

export default router;