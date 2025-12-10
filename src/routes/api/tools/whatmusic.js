import express from "express";
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { promisify } from "util";

const router = express.Router();
const unlinkAsync = promisify(fs.unlink);

class AhaMusicAPI {
  constructor() {
    this.baseUrl = "https://api.doreso.com/humming";
    this.headers = {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
      accept: "application/json, text/plain, */*",
      origin: "https://www.aha-music.com",
      referer: "https://www.aha-music.com/",
    };
  }

  async detectSong(audioBuffer) {
    const form = new FormData();
    form.append("file", audioBuffer, {
      filename: "audio.mp3",
      contentType: "audio/mp3",
    });
    form.append("sample_size", 118784);

    const response = await axios.post(this.baseUrl, form, {
      headers: {
        ...form.getHeaders(),
        ...this.headers,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return response.data;
  }
}

/** 🧩 POST Route - للرفع المباشر للملف الصوتي */
router.post("/", async (req, res) => {
  let tempPath = null;

  try {
    if (!req.files || !req.files.audio) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يجب إرسال ملف صوتي",
      });
    }

    const audioFile = req.files.audio;
    tempPath = `./tmp/aha_${Date.now()}.mp3`;

    // حفظ الملف مؤقتاً
    await audioFile.mv(tempPath);

    // قراءة الملف
    const audioBuffer = fs.readFileSync(tempPath);

    // استدعاء API
    const ahaMusic = new AhaMusicAPI();
    const result = await ahaMusic.detectSong(audioBuffer);

    if (!result?.data?.title) {
      return res.status(404).json({
        status: false,
        message: "❌ لم أستطع التعرف على الأغنية",
      });
    }

    const { title, artists } = result.data;

    res.json({
      status: true,
      message: "🎶 تم التعرف على الأغنية!",
      data: {
        title,
        artists,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحليل المقطع الصوتي",
      error: err.message,
    });
  } finally {
    // حذف الملف المؤقت
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        await unlinkAsync(tempPath);
      } catch (cleanupErr) {
        console.error("⚠️ فشل حذف الملف المؤقت:", cleanupErr);
      }
    }
  }
});

/** 🧩 GET Route - للتعرف من رابط مباشر */
router.get("/", async (req, res) => {
  let tempPath = null;

  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يجب إرسال رابط الملف الصوتي (url)",
      });
    }

    // تحميل الملف الصوتي من الرابط
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const audioBuffer = Buffer.from(response.data);

    // حفظ مؤقتاً (اختياري - يمكن إرسال Buffer مباشرة)
    tempPath = `./tmp/aha_${Date.now()}.mp3`;
    await fs.promises.writeFile(tempPath, audioBuffer);

    // استدعاء API
    const ahaMusic = new AhaMusicAPI();
    const result = await ahaMusic.detectSong(audioBuffer);

    if (!result?.data?.title) {
      return res.status(404).json({
        status: false,
        message: "❌ لم أستطع التعرف على الأغنية",
      });
    }

    const { title, artists } = result.data;

    res.json({
      status: true,
      message: "🎶 تم التعرف على الأغنية!",
      data: {
        title,
        artists,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحليل المقطع الصوتي",
      error: err.message,
    });
  } finally {
    // حذف الملف المؤقت
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        await unlinkAsync(tempPath);
      } catch (cleanupErr) {
        console.error("⚠️ فشل حذف الملف المؤقت:", cleanupErr);
      }
    }
  }
});

export default router;