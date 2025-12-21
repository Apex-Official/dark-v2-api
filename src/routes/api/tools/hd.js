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

  async getImageBase64(path) {
    return fs.readFileSync(path).toString("base64");
  }

  async upscale({ imagePath = null, imageBase64 = null, model = 3 }) {
    try {
      let base64Data;

      if (imagePath) {
        base64Data = await this.getImageBase64(imagePath);
      } else if (imageBase64) {
        base64Data = imageBase64;
      } else {
        throw new Error("يجب توفير imagePath أو imageBase64");
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

      // الحصول على النتيجة
      const resultResponse = await axios.post(
        this.resultUrl,
        { task_id: taskId },
        { headers: this.headers }
      );

      return {
        id: taskId,
        output: resultResponse.data.data.output,
        input: resultResponse.data.data.input,
      };
    } catch (err) {
      throw new Error(err.message);
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { imagePath, imageBase64, model } = req.body;

    if (!imagePath && !imageBase64) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يجب توفير imagePath أو imageBase64",
      });
    }

    const upscaler = new ImageUpscaler();
    const result = await upscaler.upscale({ imagePath, imageBase64, model });

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
    const { imagePath, imageBase64, model } = req.query;

    if (!imagePath && !imageBase64) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يجب توفير imagePath أو imageBase64",
      });
    }

    const upscaler = new ImageUpscaler();
    const result = await upscaler.upscale({
      imagePath,
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