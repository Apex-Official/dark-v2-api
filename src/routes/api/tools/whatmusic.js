import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

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
    // نمرّر البافر مباشرةً مع اسم و contentType
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
      // يمكنك ضبط timeout إذا رغبت
      timeout: 30000,
    });

    return response.data;
  }
}

/** 🧩 POST Route - رفع ملف مباشر (لا تخزين على القرص) */
router.post("/", async (req, res) => {
  try {
    // دعم express-fileupload (req.files.audio.data) أو multer (req.file.buffer)
    const audioBuffer =
      req.files?.audio?.data ?? // express-fileupload
      req.file?.buffer ?? // multer single()
      null;

    if (!audioBuffer) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يجب إرسال ملف صوتي (multipart/form-data)",
      });
    }

    const ahaMusic = new AhaMusicAPI();
    const result = await ahaMusic.detectSong(audioBuffer);

    if (!result?.data?.title) {
      return res.status(404).json({
        status: false,
        message: "❌ لم أستطع التعرف على الأغنية",
        raw: result ?? null,
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
    console.error("POST /aha error:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحليل المقطع الصوتي",
      error: err.message,
    });
  }
});

/** 🧩 GET Route - للتعرف من رابط مباشر (لا تخزين على القرص) */
router.get("/", async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يجب إرسال رابط الملف الصوتي (url)",
      });
    }

    // تحميل الملف كـ arraybuffer ثم تحويله إلى Buffer
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const audioBuffer = Buffer.from(response.data);

    const ahaMusic = new AhaMusicAPI();
    const result = await ahaMusic.detectSong(audioBuffer);

    if (!result?.data?.title) {
      return res.status(404).json({
        status: false,
        message: "❌ لم أستطع التعرف على الأغنية",
        raw: result ?? null,
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
    console.error("GET /aha error:", err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحليل المقطع الصوتي",
      error: err.message,
    });
  }
});

export default router;