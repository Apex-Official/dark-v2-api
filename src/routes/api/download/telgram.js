import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";

const router = express.Router();

// ===== دالة استخراج Token من الصفحة =====
async function getToken() {
  try {
    const response = await axios.get("https://steptodown.com/telegram-video-downloader/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    const $ = cheerio.load(response.data);
    const token = $("#token").val();
    
    console.log("Token:", token);
    return token;
  } catch (error) {
    console.error("خطأ في الحصول على Token:", error.message);
    return null;
  }
}

// ===== دالة الحصول على بيانات الفيديو =====
async function getVideoData(url, token) {
  try {
    const response = await axios.post(
      "https://steptodown.com/wp-json/aio-dl/video-data/",
      `url=${encodeURIComponent(url)}&token=${token}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
          "Referer": "https://steptodown.com/telegram-video-downloader/",
          "Origin": "https://steptodown.com",
          "Accept": "*/*"
        }
      }
    );

    console.log("استجابة API:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error("خطأ في الحصول على البيانات:", error.message);
    return null;
  }
}

// ===== دالة الحصول على رابط التحميل المباشر =====
function getDirectDownloadUrl(videoData) {
  try {
    if (!videoData || !videoData.medias || videoData.medias.length === 0) {
      return null;
    }

    const media = videoData.medias[0];
    
    // استخراج رابط التحميل الفعلي من البيانات
    let downloadUrl = media.url;
    
    // إذا كان الرابط يحتوي على معامل "url"، استخرجه
    if (downloadUrl && downloadUrl.includes('url=')) {
      const urlMatch = downloadUrl.match(/url=([^&]+)/);
      if (urlMatch) {
        downloadUrl = decodeURIComponent(urlMatch[1]);
      }
    }
    
    // إذا كان الرابط من telesco.pe مباشرة، استخدمه
    if (downloadUrl && downloadUrl.includes('telesco.pe')) {
      return downloadUrl;
    }
    
    // إذا كان هناك رابط مباشر في extension أو أي حقل آخر
    if (media.videoUrl) {
      return media.videoUrl;
    }
    
    // كحل أخير، استخدم رابط steptodown
    const encodedMedia = Buffer.from(downloadUrl || "0").toString('base64');
    return `https://steptodown.com/wp-content/plugins/aio-video-downloader/download.php?source=telegram&media=${encodedMedia}&start=1`;
    
  } catch (error) {
    console.error("خطأ في استخراج رابط التحميل:", error.message);
    return null;
  }
}

// ===== الدالة الرئيسية للتحميل من تليجرام =====
async function telegramDownload(url) {
  try {
    console.log("بدء التحميل:", url);
    
    // 1. الحصول على Token
    const token = await getToken();
    if (!token) {
      return { success: false, error: "فشل الحصول على التوكن" };
    }

    // 2. الحصول على بيانات الفيديو
    const videoData = await getVideoData(url, token);
    if (!videoData || !videoData.medias || videoData.medias.length === 0) {
      return { success: false, error: "لم يتم العثور على بيانات الفيديو" };
    }

    // 3. الحصول على رابط التحميل المباشر
    const downloadUrl = getDirectDownloadUrl(videoData);
    
    if (!downloadUrl) {
      return { success: false, error: "فشل استخراج رابط التحميل" };
    }

    console.log("رابط التحميل النهائي:", downloadUrl);

    return {
      success: true,
      title: videoData.title || "تحميل من تليجرام",
      thumbnail: videoData.thumbnail || videoData.medias[0].thumb,
      downloadUrl: downloadUrl,
      quality: videoData.medias[0].quality,
      extension: videoData.medias[0].extension || "mp4",
      source: "steptodown.com",
      videoData: videoData
    };
  } catch (error) {
    console.error("خطأ عام:", error);
    return { 
      success: false, 
      error: `خطأ: ${error.message}` 
    };
  }
}

/** 🧩 POST Route - تحميل من تليجرام */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "❌ الرجاء إدخال رابط تليجرام",
        examples: [
          "https://t.me/channel/123",
          "https://t.me/c/123456/789"
        ]
      });
    }

    // التحقق من صحة الرابط
    if (!url.match(/t\.me\/(c\/)?[\w\d_]+\/\d+/i)) {
      return res.status(400).json({
        status: false,
        message: "❌ الرجاء إدخال رابط تليجرام صحيح!"
      });
    }

    const result = await telegramDownload(url);

    if (!result.success) {
      return res.status(500).json({
        status: false,
        message: `❌ فشل التحميل: ${result.error}`,
        error: result.error
      });
    }

    if (!result.downloadUrl) {
      return res.status(404).json({
        status: false,
        message: "❌ لم يتم العثور على رابط التحميل"
      });
    }

    res.json({
      status: true,
      message: "✅ تم التحميل بنجاح",
      data: {
        title: result.title,
        thumbnail: result.thumbnail,
        downloadUrl: result.downloadUrl,
        quality: result.quality,
        extension: result.extension,
        source: result.source
      }
    });

  } catch (error) {
    console.error("Telegram Download Error:", error);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التحميل من تليجرام",
      error: error.message
    });
  }
});

/** 🧩 GET Route - تحميل من تليجرام */
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "❌ الرجاء إدخال رابط تليجرام",
        example: "/telegram?url=https://t.me/channel/123",
        examples: [
          "https://t.me/channel/123",
          "https://t.me/c/123456/789"
        ]
      });
    }

    // التحقق من صحة الرابط
    if (!url.match(/t\.me\/(c\/)?[\w\d_]+\/\d+/i)) {
      return res.status(400).json({
        status: false,
        message: "❌ الرجاء إدخال رابط تليجرام صحيح!"
      });
    }

    const result = await telegramDownload(url);

    if (!result.success) {
      return res.status(500).json({
        status: false,
        message: `❌ فشل التحميل: ${result.error}`,
        error: result.error
      });
    }

    if (!result.downloadUrl) {
      return res.status(404).json({
        status: false,
        message: "❌ لم يتم العثور على رابط التحميل"
      });
    }

    res.json({
      status: true,
      message: "✅ تم التحميل بنجاح",
      data: {
        title: result.title,
        thumbnail: result.thumbnail,
        downloadUrl: result.downloadUrl,
        quality: result.quality,
        extension: result.extension,
        source: result.source
      }
    });

  } catch (error) {
    console.error("Telegram Download Error:", error);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التحميل من تليجرام",
      error: error.message
    });
  }
});

export default router;