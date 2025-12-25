// routes/traidmode-download.js
import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const router = express.Router();

class TraidModeDownload {
  constructor() {
    this.siteBase = "https://traidmode.com";
    this.maxSendBytes = 250 * 1024 * 1024; // 250 MB
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 14)",
      Accept: "text/html,application/xhtml+xml",
      Referer: "https://traidmode.com",
    };
  }

  extractFromGetUrl(getUrl) {
    try {
      const urlObj = new URL(getUrl);
      const directUrl = urlObj.searchParams.get("urls");
      const filename = urlObj.searchParams.get("names");

      if (!directUrl) throw new Error("لم يتم العثور على رابط التحميل في معاملات URL");

      return {
        url: directUrl,
        filename: filename
          ? decodeURIComponent(filename)
          : directUrl.split("/").pop().split("?")[0],
        source: "traidmode",
      };
    } catch (error) {
      throw new Error(`خطأ في تحليل رابط Get: ${error.message}`);
    }
  }

  async getDirectDownloadLink(pageUrl) {
    try {
      let url = pageUrl;
      if (!url.includes("/download"))
        url = url.endsWith("/") ? `${url}download/` : `${url}/download/`;

      const response = await fetch(url, {
        headers: this.headers,
        redirect: "follow",
        timeout: 15000,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const html = await response.text();
      const $ = cheerio.load(html);

      let getLink = null;
      $("a").each((i, elem) => {
        const href = $(elem).attr("href");
        if (href && href.includes("/get/?urls=")) {
          getLink = href.startsWith("http") ? href : `${this.siteBase}${href}`;
          return false;
        }
        if (href && href.endsWith(".apk")) {
          getLink = href.startsWith("http") ? href : href;
          return false;
        }
      });

      if (getLink) {
        if (getLink.includes("/get/?urls=")) return this.extractFromGetUrl(getLink);
        return {
          url: getLink,
          filename: getLink.split("/").pop().split("?")[0],
          source: "traidmode",
        };
      }

      throw new Error("لم يتم العثور على رابط التحميل في الصفحة");
    } catch (error) {
      throw new Error(`فشل استخراج الرابط: ${error.message}`);
    }
  }

  async downloadFile(fileUrl) {
    try {
      const headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14)",
        Accept: "*/*",
        Connection: "Keep-Alive",
      };

      // Get file size
      let fileSize = 0;
      try {
        const headResponse = await fetch(fileUrl, { method: "HEAD", headers, timeout: 10000 });
        if (headResponse.ok) fileSize = parseInt(headResponse.headers.get("content-length") || "0");
      } catch {}

      if (fileSize && fileSize > this.maxSendBytes) {
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        return {
          success: false,
          error: "file_too_large",
          message: `⚠️ الملف كبير جداً (${fileSizeMB} MB) - الحد الأقصى: 250 MB`,
          fileSize: fileSizeMB,
          url: fileUrl,
        };
      }

      // Download file
      const response = await fetch(fileUrl, { headers, timeout: 300000 });
      if (!response.ok) throw new Error(`فشل التحميل: ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const actualSize = buffer.length;

      if (actualSize > this.maxSendBytes) {
        const mb = (actualSize / (1024 * 1024)).toFixed(2);
        return {
          success: false,
          error: "file_too_large",
          message: `⚠️ الملف بعد التحميل حجمه ${mb} MB - أكبر من الحد المسموح`,
          fileSize: mb,
          url: fileUrl,
        };
      }

      return {
        success: true,
        buffer: buffer,
        size: actualSize,
        sizeMB: (actualSize / (1024 * 1024)).toFixed(2),
      };
    } catch (error) {
      throw new Error(`فشل تحميل الملف: ${error.message}`);
    }
  }
}

/** 🧩 POST Route - Get Direct Link */
router.post("/link", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url)
      return res.status(400).json({ status: false, message: "⚠️ رابط الصفحة مطلوب (url)" });

    const traidDownload = new TraidModeDownload();
    const directLink = await traidDownload.getDirectDownloadLink(url);

    if (!directLink || !directLink.url) {
      return res
        .status(500)
        .json({ status: false, message: "❌ تعذّر استخراج رابط التحميل المباشر" });
    }

    res.json({
      status: true,
      message: "✅ تم استخراج الرابط بنجاح",
      data: directLink,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء استخراج الرابط",
      error: err.message,
    });
  }
});

/** 🧩 POST Route - Download File */
router.post("/file", async (req, res) => {
  try {
    const { url, filename } = req.body;
    if (!url)
      return res.status(400).json({ status: false, message: "⚠️ رابط التحميل مطلوب (url)" });

    const traidDownload = new TraidModeDownload();
    const result = await traidDownload.downloadFile(url);

    if (!result.success) {
      return res.status(400).json({
        status: false,
        message: result.message,
        error: result.error,
        fileSize: result.fileSize,
        url: result.url,
      });
    }

    const finalFilename = filename || url.split("/").pop().split("?")[0] || "file.apk";

    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", `attachment; filename="${finalFilename}"`);
    res.setHeader("Content-Length", result.size);

    res.send(result.buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحميل الملف",
      error: err.message,
    });
  }
});

/** 🧩 GET Route - Get Direct Link */
router.get("/link", async (req, res) => {
  try {
    const url = req.query.url;
    if (!url)
      return res.status(400).json({ status: false, message: "⚠️ رابط الصفحة مطلوب (url)" });

    const traidDownload = new TraidModeDownload();
    const directLink = await traidDownload.getDirectDownloadLink(url);

    if (!directLink || !directLink.url) {
      return res
        .status(500)
        .json({ status: false, message: "❌ تعذّر استخراج رابط التحميل المباشر" });
    }

    res.json({
      status: true,
      message: "✅ تم استخراج الرابط بنجاح",
      data: directLink,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء استخراج الرابط",
      error: err.message,
    });
  }
});

/** 🧩 GET Route - Download File */
router.get("/file", async (req, res) => {
  try {
    const url = req.query.url;
    const filename = req.query.filename;

    if (!url)
      return res.status(400).json({ status: false, message: "⚠️ رابط التحميل مطلوب (url)" });

    const traidDownload = new TraidModeDownload();
    const result = await traidDownload.downloadFile(url);

    if (!result.success) {
      return res.status(400).json({
        status: false,
        message: result.message,
        error: result.error,
        fileSize: result.fileSize,
        url: result.url,
      });
    }

    const finalFilename = filename || url.split("/").pop().split("?")[0] || "file.apk";

    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", `attachment; filename="${finalFilename}"`);
    res.setHeader("Content-Length", result.size);

    res.send(result.buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحميل الملف",
      error: err.message,
    });
  }
});

export default router;