import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

// ========== Method 1: hannuniverse ==========
class MediaFireDownloader1 {
  constructor() {
    this.axios = axios.create({
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Connection: "keep-alive",
      },
      timeout: 30000,
    });
  }

  async extractDownloadUrl(mediafireUrl) {
    try {
      const response = await this.axios.get(mediafireUrl);
      const $ = cheerio.load(response.data);

      let downloadButton = $("#downloadButton");
      if (downloadButton.length && downloadButton.attr("href")) {
        let downloadUrl = downloadButton.attr("href");
        if (downloadUrl.startsWith("//")) downloadUrl = "https:" + downloadUrl;

        return {
          file_name: this._extractFilename($, downloadUrl),
          download_url: downloadUrl,
          mimetype: this._getMimetype(this._extractFilename($, downloadUrl)),
          file_size: this._extractFilesize(downloadButton),
        };
      }

      downloadButton = $("a.input.popsok");
      if (downloadButton.length && downloadButton.attr("href")) {
        let downloadUrl = downloadButton.attr("href");
        if (downloadUrl.startsWith("//")) downloadUrl = "https:" + downloadUrl;

        return {
          file_name: this._extractFilename($, downloadUrl),
          download_url: downloadUrl,
          mimetype: this._getMimetype(this._extractFilename($, downloadUrl)),
          file_size: this._extractFilesize(downloadButton),
        };
      }

      downloadButton = $(".download_link a.input");
      if (downloadButton.length && downloadButton.attr("href")) {
        let downloadUrl = downloadButton.attr("href");
        if (downloadUrl.startsWith("//")) downloadUrl = "https:" + downloadUrl;

        return {
          file_name: this._extractFilename($, downloadUrl),
          download_url: downloadUrl,
          mimetype: this._getMimetype(this._extractFilename($, downloadUrl)),
          file_size: this._extractFilesize(downloadButton),
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  _extractFilename($, downloadUrl) {
    try {
      const filenameMeta = $('meta[property="og:title"]').attr("content");
      if (filenameMeta) return filenameMeta;

      const title = $("title").text();
      if (title) {
        const filename = title.split(" - ")[0].trim();
        if (filename) return filename;
      }

      try {
        const url = new URL(downloadUrl);
        const pathParts = url.pathname.split("/");
        for (let i = pathParts.length - 1; i >= 0; i--) {
          if (pathParts[i] && pathParts[i].includes(".")) {
            return decodeURIComponent(pathParts[i]);
          }
        }
      } catch (e) {}

      return null;
    } catch (e) {
      return null;
    }
  }

  _extractFilesize(element) {
    try {
      const text = element.text();
      const match = text.match(/\(([0-9.]+\s*[KMGT]?B)\)/i);
      return match ? match[1] : null;
    } catch (e) {
      return null;
    }
  }

  _getMimetype(filename) {
    if (!filename) return null;
    const ext = filename.split(".").pop().toLowerCase();
    const mimetypes = {
      zip: "application/zip",
      rar: "application/x-rar-compressed",
      "7z": "application/x-7z-compressed",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      txt: "text/plain",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      mp4: "video/mp4",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      apk: "application/vnd.android.package-archive",
      exe: "application/x-msdownload",
      json: "application/json",
    };
    return mimetypes[ext] || "application/octet-stream";
  }
}

// ========== Method 2: sxZeclips ==========
class MediaFireDownloader2 {
  constructor() {
    this.UA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36";
  }

  async fetchHTML(url) {
    const res = await axios.get(url, {
      headers: { "User-Agent": this.UA },
    });
    return res.data;
  }

  async getDirectDownload(url) {
    try {
      const html = await this.fetchHTML(url);
      const $ = cheerio.load(html);
      return $("#downloadButton").attr("href") || null;
    } catch {
      return null;
    }
  }

  async getFileMeta(url) {
    try {
      const html = await this.fetchHTML(url);
      const $ = cheerio.load(html);

      const filename =
        $("div.filename").text().trim() ||
        $("div.dl-btn-label").text().trim() ||
        null;

      const size = $("ul.details li")
        .filter((_, el) => $(el).text().includes("Size"))
        .text()
        .replace("Size:", "")
        .trim();

      return { filename, size };
    } catch {
      return { filename: null, size: null };
    }
  }

  async extract(url) {
    const key = url.match(/file\/([^/]+)/)?.[1];
    if (!key) return null;

    const page = `https://www.mediafire.com/file/${key}/file`;
    const meta = await this.getFileMeta(page);
    const direct = await this.getDirectDownload(page);

    if (!direct) return null;

    return {
      file_name: meta.filename,
      download_url: direct,
      file_size: meta.size,
    };
  }
}

// ========== Method 3: MFDownloader API ==========
class MediaFireDownloader3 {
  constructor() {
    this.api = "https://www.mediafire.com/api/1.4";
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36",
      Accept: "*/*",
      Referer: "https://www.mediafire.com/",
      Origin: "https://www.mediafire.com",
    };
  }

  async getFileInfo(quickKey) {
    try {
      const res = await axios.get(`${this.api}/file/get_info.php`, {
        headers: this.headers,
        params: { quick_key: quickKey, response_format: "json" },
        timeout: 15000,
      });

      const info = res.data?.response?.file_info;
      if (!info || info.ready !== "yes") return null;

      return {
        file_name: info.filename,
        download_url: info.links.normal_download,
        file_size: this.formatSize(+info.size),
        mimetype: info.mimetype,
      };
    } catch {
      return null;
    }
  }

  formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    const units = ["KB", "MB", "GB", "TB"];
    let i = -1;
    do {
      bytes /= 1024;
      i++;
    } while (bytes >= 1024 && i < units.length - 1);
    return bytes.toFixed(2) + " " + units[i];
  }

  async extract(url) {
    const match = url.match(/mediafire\.com\/file\/([a-z0-9]+)/i);
    if (!match) return null;
    return await this.getFileInfo(match[1]);
  }
}

// ========== GET Info Route ==========
router.get("/info", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || !url.includes("mediafire.com")) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يرجى إدخال رابط MediaFire صحيح",
      });
    }

    // محاولة Method 1
    const downloader1 = new MediaFireDownloader1();
    let result = await downloader1.extractDownloadUrl(url);

    // إذا فشل، جرب Method 2
    if (!result) {
      const downloader2 = new MediaFireDownloader2();
      result = await downloader2.extract(url);
    }

    // إذا فشل، جرب Method 3
    if (!result) {
      const downloader3 = new MediaFireDownloader3();
      result = await downloader3.extract(url);
    }

    // إذا فشلت كل المحاولات
    if (!result || !result.download_url) {
      return res.status(500).json({
        status: false,
        message: "❌ فشل استخراج رابط التحميل من جميع الطرق",
      });
    }

    res.json({
      status: true,
      message: "✅ تم استخراج الرابط بنجاح",
      data: {
        filename: result.file_name || "Unknown",
        size: result.file_size || "Unknown",
        mimetype: result.mimetype || "application/octet-stream",
        download: result.download_url,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ غير متوقع",
      error: err.message,
    });
  }
});

// ========== Streaming Download Route ==========
router.get("/download", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || !url.includes("mediafire.com")) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يرجى إدخال رابط MediaFire صحيح",
      });
    }

    // محاولة Method 1
    const downloader1 = new MediaFireDownloader1();
    let result = await downloader1.extractDownloadUrl(url);

    // إذا فشل، جرب Method 2
    if (!result) {
      const downloader2 = new MediaFireDownloader2();
      result = await downloader2.extract(url);
    }

    // إذا فشل، جرب Method 3
    if (!result) {
      const downloader3 = new MediaFireDownloader3();
      result = await downloader3.extract(url);
    }

    // إذا فشلت كل المحاولات
    if (!result || !result.download_url) {
      return res.status(500).json({
        status: false,
        message: "❌ فشل استخراج رابط التحميل من جميع الطرق",
      });
    }

    // ========== Streaming مباشر ==========
    const response = await axios({
      method: "GET",
      url: result.download_url,
      responseType: "stream",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // تعيين Headers للتحميل
    const filename = result.file_name || "mediafire_file";
    const mimetype = result.mimetype || "application/octet-stream";

    res.setHeader("Content-Type", mimetype);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"]);
    }

    // Stream الملف مباشرة للمستخدم
    response.data.pipe(res);

    // معالجة الأخطاء
    response.data.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          status: false,
          message: "❌ حدث خطأ أثناء تحميل الملف",
        });
      }
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({
        status: false,
        message: "❌ حدث خطأ غير متوقع",
        error: err.message,
      });
    }
  }
});

// ========== POST Info Route ==========
router.post("/info", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !url.includes("mediafire.com")) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يرجى إدخال رابط MediaFire صحيح",
      });
    }

    const downloader1 = new MediaFireDownloader1();
    let result = await downloader1.extractDownloadUrl(url);

    if (!result) {
      const downloader2 = new MediaFireDownloader2();
      result = await downloader2.extract(url);
    }

    if (!result) {
      const downloader3 = new MediaFireDownloader3();
      result = await downloader3.extract(url);
    }

    if (!result || !result.download_url) {
      return res.status(500).json({
        status: false,
        message: "❌ فشل استخراج رابط التحميل من جميع الطرق",
      });
    }

    res.json({
      status: true,
      message: "✅ تم استخراج الرابط بنجاح",
      data: {
        filename: result.file_name || "Unknown",
        size: result.file_size || "Unknown",
        mimetype: result.mimetype || "application/octet-stream",
        download: result.download_url,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ غير متوقع",
      error: err.message,
    });
  }
});

// ========== POST Streaming Download Route ==========
router.post("/download", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !url.includes("mediafire.com")) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يرجى إدخال رابط MediaFire صحيح",
      });
    }

    const downloader1 = new MediaFireDownloader1();
    let result = await downloader1.extractDownloadUrl(url);

    if (!result) {
      const downloader2 = new MediaFireDownloader2();
      result = await downloader2.extract(url);
    }

    if (!result) {
      const downloader3 = new MediaFireDownloader3();
      result = await downloader3.extract(url);
    }

    if (!result || !result.download_url) {
      return res.status(500).json({
        status: false,
        message: "❌ فشل استخراج رابط التحميل من جميع الطرق",
      });
    }

    // ========== Streaming مباشر ==========
    const response = await axios({
      method: "GET",
      url: result.download_url,
      responseType: "stream",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const filename = result.file_name || "mediafire_file";
    const mimetype = result.mimetype || "application/octet-stream";

    res.setHeader("Content-Type", mimetype);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"]);
    }

    response.data.pipe(res);

    response.data.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          status: false,
          message: "❌ حدث خطأ أثناء تحميل الملف",
        });
      }
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({
        status: false,
        message: "❌ حدث خطأ غير متوقع",
        error: err.message,
      });
    }
  }
});

export default router;