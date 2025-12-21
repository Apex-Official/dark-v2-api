import express from "express";
import axios from "axios";
import FormData from "form-data";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const TMP_DIR = path.join(__dirname, "tmp");

// إنشاء مجلد tmp إذا لم يكن موجوداً
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

class HDUpscaler {
  constructor() {
    this.imageApi = "https://aienhancer.ai/api/v1/r/image-enhance";
    this.videoApi = "https://api.unblurimage.ai";
    this.imageHeaders = {
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
      const tempPath = path.join(TMP_DIR, `temp_${Date.now()}.jpg`);
      await this.downloadFile(imageUrl, tempPath);

      // قراءة الصورة وتحويلها لـ base64
      const imageBuffer = fs.readFileSync(tempPath);
      const base64Image = imageBuffer.toString("base64");

      // إنشاء طلب التحسين
      const createResponse = await axios.post(
        `${this.imageApi}/create`,
        {
          model: 3,
          image: `data:image/jpeg;base64,${base64Image}`,
          settings: "kRpBbpnRCD2nL2RxnnuoMo7MBc0zHndTDkWMl9aW+Gw=",
        },
        { headers: this.imageHeaders }
      );

      const taskId = createResponse.data.data.id;

      // الحصول على النتيجة
      const resultResponse = await axios.post(
        `${this.imageApi}/result`,
        { task_id: taskId },
        { headers: this.imageHeaders }
      );

      // حذف الملف المؤقت
      fs.unlinkSync(tempPath);

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

  async upscaleVideo(videoUrl) {
    try {
      const productSerial = crypto.randomUUID().replace(/-/g, "");
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      // تحميل الفيديو
      const tempVideoPath = path.join(TMP_DIR, `temp_video_${Date.now()}.mp4`);
      await this.downloadFile(videoUrl, tempVideoPath);

      // 1. طلب رابط الرفع
      const uploadForm = new FormData();
      uploadForm.append("video_file_name", `cli-${Date.now()}.mp4`);

      const uploadResp = await axios.post(
        `${this.videoApi}/api/upscaler/v1/ai-video-enhancer/upload-video`,
        uploadForm,
        { headers: uploadForm.getHeaders() }
      );

      if (uploadResp.data.code !== 100000) {
        throw new Error("فشل طلب رابط الرفع");
      }

      const { url: uploadUrl, object_name } = uploadResp.data.result;

      // 2. رفع الفيديو
      const videoBuffer = fs.readFileSync(tempVideoPath);
      await axios.put(uploadUrl, videoBuffer, {
        headers: { "content-type": "video/mp4" },
      });

      const cdnUrl = `https://cdn.unblurimage.ai/${object_name}`;

      // 3. إنشاء وظيفة التحسين
      const jobForm = new FormData();
      jobForm.append("original_video_file", cdnUrl);
      jobForm.append("resolution", "2k");
      jobForm.append("is_preview", "false");

      const createJobResp = await axios.post(
        `${this.videoApi}/api/upscaler/v2/ai-video-enhancer/create-job`,
        jobForm,
        {
          headers: {
            ...jobForm.getHeaders(),
            "product-serial": productSerial,
            authorization: "",
          },
        }
      );

      if (createJobResp.data.code !== 100000) {
        throw new Error("فشل إنشاء وظيفة التحسين");
      }

      const { job_id } = createJobResp.data.result;

      // 4. انتظار اكتمال المعالجة
      const startTime = Date.now();
      const maxWait = 5 * 60 * 1000; // 5 دقائق

      while (true) {
        const jobResp = await axios.get(
          `${this.videoApi}/api/upscaler/v2/ai-video-enhancer/get-job/${job_id}`,
          {
            headers: {
              "product-serial": productSerial,
              authorization: "",
            },
          }
        );

        if (jobResp.data?.code === 100000 && jobResp.data.result?.output_url) {
          // حذف الملف المؤقت
          fs.unlinkSync(tempVideoPath);

          return {
            success: true,
            job_id,
            output: jobResp.data.result.output_url,
            resolution: "2k",
          };
        }

        if (Date.now() - startTime > maxWait) {
          throw new Error("انتهت مهلة الانتظار لمعالجة الفيديو");
        }

        await sleep(10000); // انتظر 10 ثواني قبل المحاولة التالية
      }
    } catch (error) {
      throw new Error(`فشل تحسين الفيديو: ${error.message}`);
    }
  }
}

/** 🖼️ POST Route - Image Upscale */
router.post("/image", async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الصورة مطلوب (imageUrl)",
      });
    }

    const upscaler = new HDUpscaler();
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

/** 🎥 POST Route - Video Upscale */
router.post("/video", async (req, res) => {
  try {
    const { videoUrl } = req.body;

    if (!videoUrl) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الفيديو مطلوب (videoUrl)",
      });
    }

    res.json({
      status: true,
      message: "⏳ جاري معالجة الفيديو... قد يستغرق 2-5 دقائق",
      note: "سيتم إرسال النتيجة عند الانتهاء",
    });

    const upscaler = new HDUpscaler();
    const result = await upscaler.upscaleVideo(videoUrl);

    // في الواقع، يجب إرسال النتيجة عبر webhook أو socket
    console.log("Video upscale completed:", result);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحسين الفيديو",
      error: err.message,
    });
  }
});

/** 🖼️ GET Route - Image Upscale */
router.get("/image", async (req, res) => {
  try {
    const { imageUrl } = req.query;

    if (!imageUrl) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الصورة مطلوب (imageUrl)",
      });
    }

    const upscaler = new HDUpscaler();
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

/** 🎥 GET Route - Video Upscale */
router.get("/video", async (req, res) => {
  try {
    const { videoUrl } = req.query;

    if (!videoUrl) {
      return res.status(400).json({
        status: false,
        message: "⚠️ رابط الفيديو مطلوب (videoUrl)",
      });
    }

    const upscaler = new HDUpscaler();
    const result = await upscaler.upscaleVideo(videoUrl);

    res.json({
      status: true,
      message: "✅ تم تحسين جودة الفيديو بنجاح",
      data: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء تحسين الفيديو",
      error: err.message,
    });
  }
});

/** 📋 معلومات عن الـ API */
router.get("/", (req, res) => {
  res.json({
    status: true,
    message: "🎨 HD Upscaler API",
    endpoints: {
      image: {
        post: "/api/upscale/image",
        get: "/api/upscale/image?imageUrl=URL",
        description: "تحسين جودة الصور",
      },
      video: {
        post: "/api/upscale/video",
        get: "/api/upscale/video?videoUrl=URL",
        description: "تحسين جودة الفيديوهات (2K)",
      },
    },
    notes: [
      "معالجة الصور تستغرق ثوانٍ قليلة",
      "معالجة الفيديو تستغرق 2-5 دقائق",
      "جودة الفيديو المحسّنة: 2K",
    ],
  });
});

export default router;