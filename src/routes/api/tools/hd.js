import express from "express";
import axios from "axios";
import fs from "fs";

const router = express.Router();

class ImageUpscaler {
  constructor() {
    this.createUrl = "https://aienhancer.ai/api/v1/r/image-enhance/create";
    this.resultUrl = "https://aienhancer.ai/api/v1/r/image-enhance/result";
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10)",
      "Content-Type": "application/json",
      origin: "https://aienhancer.ai",
      referer: "https://aienhancer.ai/ai-image-upscaler",
    };
  }

  async getImageBase64FromPath(path) {
    return fs.readFileSync(path).toString("base64");
  }

  async getImageBase64FromUrl(url) {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(response.data, "binary").toString("base64");
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getResult(taskId, maxRetries = 30) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.sleep(2000); // انتظار 2 ثانية بين كل محاولة

        const resultResponse = await axios.post(
          this.resultUrl,
          { task_id: taskId },
          { headers: this.headers }
        );

        // التحقق من حالة النتيجة
        const data = resultResponse.data.data;
        
        if (data && data.output) {
          return {
            id: taskId,
            output: data.output,
            input: data.input,
          };
        }

        // إذا كانت المعالجة لا تزال جارية
        if (resultResponse.data.data?.status === "processing") {
          console.log(`⏳ جاري المعالجة... محاولة ${i + 1}/${maxRetries}`);
          continue;
        }

      } catch (err) {
        // إذا كان الخطأ 503 أو مشاكل مؤقتة، نعيد المحاولة
        if (err.response?.status === 503 || err.code === "ECONNABORTED") {
          console.log(`⚠️ محاولة ${i + 1}/${maxRetries} - إعادة المحاولة...`);
          continue;
        }
        throw err;
      }
    }

    throw new Error("انتهت المحاولات - الصورة لم تكتمل معالجتها");
  }

  async upscale({ imagePath = null, imageUrl = null, imageBase64 = null, model = 3 }) {
    try {
      let base64Data;

      if (imageUrl) {
        base64Data = await this.getImageBase64FromUrl(imageUrl);
      } else if (imagePath) {
        base64Data = await this.getImageBase64FromPath(imagePath);
      } else if (imageBase64) {
        base64Data = imageBase64;
      } else {
        throw new Error("يجب توفير imageUrl أو imagePath أو imageBase64");
      }

      // إنشاء مهمة التحسين
      const createResponse = await axios.post(
        this.createUrl,
        {
          model,
          image: `data:image/jpeg;base64,${base64Data}`,
          settings: "kRpBbpnRCD2nL2RxnnuoMo7MBc0zHndTDkWMl9aW+Gw=",
        },
        { headers: this.headers }
      );

      const taskId = createResponse.data.data.id;
      console.log(`✅ تم إنشاء المهمة: ${taskId}`);

      // الحصول على النتيجة مع إعادة المحاولة
      const result = await this.getResult(taskId);

      return result;
    } catch (err) {
      throw new Error(err.message);
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { imagePath, imageUrl, imageBase64, model } = req.body;

    if (!imagePath && !imageUrl && !imageBase64) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يجب توفير imageUrl أو imagePath أو imageBase64",
      });
    }

    const upscaler = new ImageUpscaler();
    const result = await upscaler.upscale({ imagePath, imageUrl, imageBase64, model });

    res.json({
      status: true,
      message: "✅ تم تحسين الصورة بنجاح",
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

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { imagePath, imageUrl, imageBase64, model } = req.query;

    if (!imagePath && !imageUrl && !imageBase64) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يجب توفير imageUrl أو imagePath أو imageBase64",
      });
    }

    const upscaler = new ImageUpscaler();
    const result = await upscaler.upscale({
      imagePath,
      imageUrl,
      imageBase64,
      model: model ? parseInt(model) : 3,
    });

    res.json({
      status: true,
      message: "✅ تم تحسين الصورة بنجاح",
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