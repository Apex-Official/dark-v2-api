import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

class RemoveBgAPI {
  constructor() {
    this.baseUrl = "https://removebg.one/api/predict/v2";
    this.headers = {
      "user-agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36",
      accept: "application/json, text/plain, */*",
      "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
      platform: "PC",
      "sec-ch-ua-platform": '"Android"',
      origin: "https://removebg.one",
      referer: "https://removebg.one/upload",
    };
  }

  async getImageBuffer(imageUrl) {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    return Buffer.from(response.data);
  }

  async removeBg(buffer) {
    const form = new FormData();
    form.append("file", buffer, {
      filename: "image.jpg",
      contentType: "image/jpeg",
    });

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

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الصورة مطلوب (imageUrl)",
      });
    }

    const removeBgAPI = new RemoveBgAPI();
    const buffer = await removeBgAPI.getImageBuffer(imageUrl);
    const result = await removeBgAPI.removeBg(buffer);

    if (!result?.data?.cutoutUrl) {
      return res.status(500).json({
        status: false,
        message: "❌ فشل في إزالة الخلفية، حاول مرة أخرى",
      });
    }

    res.json({
      status: true,
      message: "✅ تم إزالة الخلفية بنجاح",
      result: {
        original: imageUrl,
        cutout: result.data.cutoutUrl,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة الصورة",
      error: err.message,
    });
  }
});

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { imageUrl } = req.query;

    if (!imageUrl) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الصورة مطلوب (imageUrl)",
      });
    }

    const removeBgAPI = new RemoveBgAPI();
    const buffer = await removeBgAPI.getImageBuffer(imageUrl);
    const result = await removeBgAPI.removeBg(buffer);

    if (!result?.data?.cutoutUrl) {
      return res.status(500).json({
        status: false,
        message: "❌ فشل في إزالة الخلفية، حاول مرة أخرى",
      });
    }

    res.json({
      status: true,
      message: "✅ تم إزالة الخلفية بنجاح",
      result: {
        original: imageUrl,
        cutout: result.data.cutoutUrl,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء معالجة الصورة",
      error: err.message,
    });
  }
});

export default router;