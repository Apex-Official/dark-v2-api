import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

/*-----------------------------
       🎵 AHA MUSIC API
------------------------------*/
class AhaMusicAPI {
  constructor() {
    this.baseUrl = "https://api.doreso.com/humming";
    this.defaultHeaders = {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
      accept: "application/json, text/plain, */*",
      origin: "https://www.aha-music.com",
      referer: "https://www.aha-music.com/",
    };
  }

  async downloadAudio(url) {
    const res = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(res.data);
  }

  async detectFromUrl(audioUrl) {
    const audioBuffer = await this.downloadAudio(audioUrl);

    const form = new FormData();
    form.append("file", audioBuffer, {
      filename: "audio.mp3",
      contentType: "audio/mpeg",
    });

    form.append("sample_size", 118784);

    const response = await axios.post(this.baseUrl, form, {
      headers: {
        ...form.getHeaders(),
        ...this.defaultHeaders,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return response.data;
  }
}

/*-----------------------------
       🎵 POST Route
  (التعرف على الصوت من رابط)
------------------------------*/
router.post("/", async (req, res) => {
  try {
    const { audioUrl } = req.body;

    if (!audioUrl)
      return res.status(400).json({
        status: false,
        message: "⚠️ يرجى إرسال رابط الصوت: audioUrl",
      });

    const aha = new AhaMusicAPI();
    const result = await aha.detectFromUrl(audioUrl);

    if (!result?.data?.title)
      return res.json({
        status: false,
        message: "❌ لم يتم التعرف على الأغنية",
      });

    res.json({
      status: true,
      message: "✅ تم التعرف على الأغنية بنجاح",
      response: {
        title: result.data.title,
        artists: result.data.artists,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحليل رابط الصوت",
      error: err.message,
    });
  }
});

/*-----------------------------
       🎵 GET Route (اختبار)
------------------------------*/
router.get("/", async (req, res) => {
  res.json({
    status: true,
    message: "🎵 AHA Music URL API جاهز",
    usage: "أرسل POST مع { audioUrl: 'http://example.com/audio.mp3' }",
  });
});

export default router;