import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const TMP_DIR = path.join(__dirname, "../tmp");

// إنشاء مجلد tmp إذا لم يكن موجوداً
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

class ImageUpscaler {
  constructor() {
    this.baseApi = "https://aienhancer.ai/api/v1/r/image-enhance";
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10)",
      "Content-Type": "application/json",
      origin: "https://aienhancer.ai",
      referer: "https://aienhancer.ai/ai-image-upscaler",
    };
  }

  async downloadFile(url, filepath) {
    const response = await axios.get(url, { responseType: "stream" });
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  }

  async upscaleImage(imageUrl) {
    try {
      // تحميل الصورة
      const tempPath = path.join(TMP_DIR, `temp_image_${Date.now()}.jpg`);
      await this.downloadFile(imageUrl, tempPath);

      // قراءة الصورة وتحويلها لـ base64
      const imageBuffer = fs.readFileSync(tempPath);
      const base64Image = imageBuffer.toString("base64");

      // إنشاء طلب التحسين
      const createResponse = await axios.post(
        `${this.baseApi}/create`,
        {
          model: 3,
          image: `data:image/jpeg;base64,${base64Image}`,
          settings: "kRpBbpnRCD2nL2RxnnuoMo7MBc0zHndTDkWMl9aW+Gw=",
        },
        { headers: this.headers }
      );

      const taskId = createResponse.data.data.id;

      // الحصول على النتيجة
      const resultResponse = await axios.post(
        `${this.baseApi}/result`,
        { task_id: taskId },
        { headers: this.headers }
      );

      // حذف الملف المؤقت
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      return {
        success: true,
        id: taskId,
        output: resultResponse.data.data.output,
        input: resultResponse.data.data.input,
      };
    } catch (error) {
      throw new Error(`فشل تحسين الصورة: ${error.message}`);
    }
  }

  async upscaleImageFromBase64(base64Data) {
    try {
      // إنشاء طلب التحسين مباشرة من base64
      const createResponse = await axios.post(
        `${this.baseApi}/create`,
        {
          model: 3,
          image: base64Data.includes("base64,") 
            ? base64Data 
            : `data:image/jpeg;base64,${base64Data}`,
          settings: "kRpBbpnRCD2nL2RxnnuoMo7MBc0zHndTDkWMl9aW+Gw=",
        },
        { headers: this.headers }
      );

      const taskId = createResponse.data.data.id;

      // الحصول على النتيجة
      const resultResponse = await axios.post(
        `${this.baseApi}/result`,
        { task_id: taskId },
        { headers: this.headers }
      );

      return {
        success: true,
        id: taskId,
        output: resultResponse.data.data.output,
        input: resultResponse.data.data.input,
      };
    } catch (error) {
      throw new Error(`فشل تحسين الصورة: ${error.message}`);
    }
  }
}

/** 🖼️ POST Route - تحسين الصورة من رابط */
router.post("/", async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الصورة مطلوب (imageUrl)",
      });
    }

    const upscaler = new ImageUpscaler();
    const result = await upscaler.upscaleImage(imageUrl);

    res.json({
      status: true,
      message: "✅ تم تحسين جودة الصورة بنجاح",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحسين الصورة",
      error: err.message,
    });
  }
});

/** 🖼️ POST Route - تحسين الصورة من base64 */
router.post("/base64", async (req, res) => {
  try {
    const { base64Data } = req.body;

    if (!base64Data) {
      return res.status(400).json({
        status: false,
        message: "⚠️ بيانات base64 مطلوبة (base64Data)",
      });
    }

    const upscaler = new ImageUpscaler();
    const result = await upscaler.upscaleImageFromBase64(base64Data);

    res.json({
      status: true,
      message: "✅ تم تحسين جودة الصورة بنجاح",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحسين الصورة",
      error: err.message,
    });
  }
});

/** 🖼️ GET Route - تحسين الصورة */
router.get("/", async (req, res) => {
  try {
    const { imageUrl } = req.query;

    if (!imageUrl) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الصورة مطلوب (imageUrl)",
      });
    }

    const upscaler = new ImageUpscaler();
    const result = await upscaler.upscaleImage(imageUrl);

    res.json({
      status: true,
      message: "✅ تم تحسين جودة الصورة بنجاح",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحسين الصورة",
      error: err.message,
    });
  }
});

export default router;