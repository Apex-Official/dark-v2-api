import express from "express";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import axios from "axios";

const execAsync = promisify(exec);
const router = express.Router();

const ELEVEN_API_KEY = "sk_536d8ab4ac257dae2ca1858ec36c7733bbd51fd3d739d27f";

const voices = [
  { arName: "ليانا", id: "Xb7hH8MSUJpSbSDYk0k2", desc: "صوت أنثوي واضح ومشرق" },
  { arName: "ميرال", id: "XB0fDUnXU5powFXDhCwa", desc: "صوت ناعم ودافئ" },
  { arName: "تاليا", id: "ThT5KcBeYPX3keUQqHPh", desc: "صوت أنثوي مشرق وحيوي" },
  { arName: "رِنا", id: "LcfcDJNUP1GQjkzn1xUU", desc: "صوت لطيف ومهذب" },
  { arName: "سيرين", id: "jsCqWAovK2LkecY7zXl4", desc: "صوت ناعم ومتزن" },
  { arName: "فاي", id: "jBpfuIE2acCO8z3wKNLl", desc: "صوت أنثوي حيوي" },
  { arName: "ياسمين", id: "oWAxZDx7w5VEj9dCyTzz", desc: "صوت راقي وأنيق" },
  { arName: "نوفا", id: "t0jbNlBVZ17f02VDIeMI", desc: "صوت شاب ومفعم بالحيوية" },
  { arName: "آية", id: "pFZP5JQG7iQjIQuC4Bku", desc: "صوت دافئ وحنون" },
  { arName: "لينا", id: "XrExE9yKIg1WjnnlVkGX", desc: "صوت بريطاني راقي" },
  { arName: "رودينا", id: "piTKgcLEGmPE4e6mEKli", desc: "صوت هادئ ومريح" },
  { arName: "جودي", id: "21m00Tcm4TlvDq8ikWAM", desc: "صوت احترافي وواضح" },
  { arName: "سلمى", id: "EXAVITQu4vr4xnSDxMaL", desc: "صوت ناعم ومعبر" },
  { arName: "ريان", id: "pNInz6obpgDQGcFmaJgB", desc: "صوت ذكوري متزن" },
  { arName: "جاد", id: "ErXwobaYiN019PkySvjV", desc: "صوت ذكوري قوي" },
  { arName: "باسل", id: "VR6AewLTigWG4xSOukaG", desc: "صوت عميق وقوي" },
  { arName: "سامي", id: "pqHfZKP75CvOlQylNhV4", desc: "صوت وثائقي احترافي" },
  { arName: "رامي", id: "nPczCjzI2devNBz1zQrb", desc: "صوت ذكوري واثق" },
  { arName: "كريم", id: "N2lVS1w4EtoT3dr4eOWO", desc: "صوت دافئ" },
  { arName: "نور", id: "IKne3meq5aSn9XLyUdCD", desc: "صوت ودي ولطيف" },
  { arName: "آدمو", id: "2EiwWnXFnvU5JabPnv8n", desc: "صوت أمريكي متوسط" },
  { arName: "فهد", id: "onwK4e9ZLuTAKqWW03F9", desc: "صوت ذكوري رسمي" },
  { arName: "دان", id: "CYw3kZ02Hs0563khs1Fj", desc: "صوت بريطاني شاب" },
  { arName: "ليو", id: "29vD33N1CtxCmqQRPOHJ", desc: "صوت أمريكي حيوي" },
];

// إنشاء مجلد tmp إذا لم يكن موجوداً
const tmpDir = path.join(process.cwd(), "tmp");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// رفع الملف على Catbox
async function uploadToCatbox(filePath) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", fs.createReadStream(filePath));

  const response = await axios.post("https://catbox.moe/user/api.php", form, {
    headers: form.getHeaders(),
  });

  return response.data.trim();
}

// توليد الصوت باستخدام curl (نفس طريقة البوت)
async function generateAudio(voiceId, text) {
  const filePath = path.join(tmpDir, `tts-${Date.now()}.mp3`);
  
  const cmd = `curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${voiceId}" \
    -H "xi-api-key: ${ELEVEN_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{ "text": "${text.replace(/"/g, '\\"')}", "voice_settings": { "stability": 0.7, "similarity_boost": 0.9 } }' \
    --output ${filePath}`;

  await execAsync(cmd);
  
  // تحقق من وجود الملف
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    throw new Error("فشل توليد الصوت");
  }

  return filePath;
}

// POST endpoint
router.post("/", async (req, res) => {
  let filePath = null;
  try {
    const { voice, text } = req.body;

    if (!voice || !text) {
      return res.json({ status: false, message: "ارسل voice و text" });
    }

    const voiceObj = voices.find((v) => v.arName === voice);
    if (!voiceObj) {
      return res.json({ status: false, message: "الصوت غير موجود" });
    }

    // توليد الصوت
    filePath = await generateAudio(voiceObj.id, text);

    // رفع على Catbox
    const url = await uploadToCatbox(filePath);

    res.json({
      status: true,
      voice,
      url,
    });
  } catch (e) {
    console.error(e);
    res.json({ status: false, error: e.message });
  } finally {
    // حذف الملف المؤقت
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

// GET endpoint
router.get("/", async (req, res) => {
  let filePath = null;
  try {
    const { voice, text } = req.query;

    if (!voice || !text) {
      return res.json({ status: false, message: "ارسل voice و text" });
    }

    const voiceObj = voices.find((v) => v.arName === voice);
    if (!voiceObj) {
      return res.json({ status: false, message: "الصوت غير موجود" });
    }

    // توليد الصوت
    filePath = await generateAudio(voiceObj.id, text);

    // رفع على Catbox
    const url = await uploadToCatbox(filePath);

    res.json({
      status: true,
      voice,
      url,
    });
  } catch (e) {
    console.error(e);
    res.json({ status: false, error: e.message });
  } finally {
    // حذف الملف المؤقت
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

// قائمة الأصوات
router.get("/voices", (req, res) => {
  res.json({
    status: true,
    voices,
  });
});

export default router;