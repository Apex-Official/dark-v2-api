import express from "express";
import axios from "axios";
import fs from "fs";
import crypto from "crypto";
import FormData from "form-data";
import path from "path";

const router = express.Router();

class VideoUpscaler {
  constructor() {
    this.baseApi = "https://api.unblurimage.ai";
    this.tmpDir = "./tmp";
    this.productSerial = crypto.randomUUID().replace(/-/g, "");
  }

  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async jsonFetch(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return { __httpError: true, status: res.status, raw: text };
    }
    if (!res.ok) return { __httpError: true, status: res.status, raw: json };
    return json;
  }

  async downloadVideo(url, outputPath) {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    fs.writeFileSync(outputPath, Buffer.from(response.data));
    return outputPath;
  }

  async getVideoBase64FromUrl(url) {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(response.data, "binary").toString("base64");
  }

  async uploadVideoToAPI(videoPath) {
    const uploadForm = new FormData();
    uploadForm.append("video_file_name", `cli-${Date.now()}.mp4`);

    const uploadResp = await axios
      .post(`${this.baseApi}/api/upscaler/v1/ai-video-enhancer/upload-video`, uploadForm, {
        headers: uploadForm.getHeaders(),
      })
      .then((r) => r.data)
      .catch((e) => ({
        __httpError: true,
        status: e.response?.status,
        raw: e.response?.data,
      }));

    if (uploadResp.__httpError || uploadResp.code !== 100000) {
      throw new Error("فشل طلب رابط الرفع");
    }

    const { url: uploadUrl, object_name } = uploadResp.result || {};
    if (!uploadUrl || !object_name) {
      throw new Error("لم يتم العثور على رابط الرفع");
    }

    await axios.put(uploadUrl, fs.createReadStream(videoPath), {
      headers: { "content-type": "video/mp4" },
    });

    return `https://cdn.unblurimage.ai/${object_name}`;
  }

  async createUpscaleJob(cdnUrl, resolution = "2k") {
    const jobForm = new FormData();
    jobForm.append("original_video_file", cdnUrl);
    jobForm.append("resolution", resolution);
    jobForm.append("is_preview", "false");

    const createJobResp = await axios
      .post(`${this.baseApi}/api/upscaler/v2/ai-video-enhancer/create-job`, jobForm, {
        headers: {
          ...jobForm.getHeaders(),
          "product-serial": this.productSerial,
          authorization: "",
        },
      })
      .then((r) => r.data)
      .catch((e) => ({
        __httpError: true,
        status: e.response?.status,
        raw: e.response?.data,
      }));

    if (createJobResp.__httpError || createJobResp.code !== 100000) {
      throw new Error("فشل إنشاء مهمة التحسين");
    }

    const { job_id } = createJobResp.result || {};
    if (!job_id) throw new Error("لم يتم العثور على Job ID");

    return job_id;
  }

  async waitForJobCompletion(jobId, maxWait = 5 * 60 * 1000) {
    const startTime = Date.now();

    while (true) {
      const jobResp = await this.jsonFetch(
        `${this.baseApi}/api/upscaler/v2/ai-video-enhancer/get-job/${jobId}`,
        {
          method: "GET",
          headers: {
            "product-serial": this.productSerial,
            authorization: "",
          },
        }
      );

      if (jobResp?.code === 100000 && jobResp.result?.output_url) {
        return jobResp.result.output_url;
      }

      if (Date.now() - startTime > maxWait) {
        throw new Error("انتهت مهلة الانتظار لمعالجة الفيديو");
      }

      console.log(`⏳ جاري المعالجة... ${Math.floor((Date.now() - startTime) / 1000)}s`);
      await this.sleep(10000); // انتظار 10 ثوانٍ
    }
  }

  async upscale({ videoPath = null, videoUrl = null, resolution = "2k" }) {
    try {
      // إنشاء مجلد tmp إذا لم يكن موجوداً
      if (!fs.existsSync(this.tmpDir)) {
        fs.mkdirSync(this.tmpDir, { recursive: true });
      }

      let localVideoPath;

      if (videoUrl) {
        // تحميل الفيديو من URL
        localVideoPath = path.join(this.tmpDir, `${Date.now()}_input.mp4`);
        await this.downloadVideo(videoUrl, localVideoPath);
      } else if (videoPath) {
        // استخدام المسار المحلي
        localVideoPath = videoPath;
      } else {
        throw new Error("يجب توفير videoUrl أو videoPath");
      }

      // رفع الفيديو إلى API
      console.log("📤 جاري رفع الفيديو...");
      const cdnUrl = await this.uploadVideoToAPI(localVideoPath);

      // إنشاء مهمة التحسين
      console.log("🎬 جاري إنشاء مهمة التحسين...");
      const jobId = await this.createUpscaleJob(cdnUrl, resolution);

      // انتظار اكتمال المعالجة
      console.log("⏳ جاري معالجة الفيديو...");
      const outputUrl = await this.waitForJobCompletion(jobId);

      // حذف الملف المؤقت إذا تم تحميله من URL
      if (videoUrl && fs.existsSync(localVideoPath)) {
        fs.unlinkSync(localVideoPath);
      }

      return {
        jobId,
        outputUrl,
        resolution,
        cdnUrl,
      };
    } catch (err) {
      throw new Error(err.message);
    }
  }
}

/** 🧩 POST Route */
router.post("/", async (req, res) => {
  try {
    const { videoPath, videoUrl, resolution } = req.body;

    if (!videoPath && !videoUrl) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يجب توفير videoUrl أو videoPath",
      });
    }

    const upscaler = new VideoUpscaler();
    const result = await upscaler.upscale({ videoPath, videoUrl, resolution });

    res.json({
      status: true,
      message: "✅ تم تحسين الفيديو بنجاح",
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

/** 🧩 GET Route */
router.get("/", async (req, res) => {
  try {
    const { videoPath, videoUrl, resolution } = req.query;

    if (!videoPath && !videoUrl) {
      return res.status(400).json({
        status: false,
        message: "⚠️ يجب توفير videoUrl أو videoPath",
      });
    }

    const upscaler = new VideoUpscaler();
    const result = await upscaler.upscale({
      videoPath,
      videoUrl,
      resolution: resolution || "2k",
    });

    res.json({
      status: true,
      message: "✅ تم تحسين الفيديو بنجاح",
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

export default router;