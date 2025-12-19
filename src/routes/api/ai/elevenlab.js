// eleven-tts-router.js
import express from "express";
import axios from "axios";
import FormData from "form-data";

const router = express.Router();

// <-- ضع هنا مفتاحك الحقيقي أو استخدم متغير بيئة بدل السطر التالي -->
const ELEVEN_API_KEY = "sk_536d8ab4ac257dae2ca1858ec36c7733bbd51fd3d739d27f";

/* -------------------------------------------
🗣️ قائمة الأصوات
------------------------------------------- */
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

/* -------------------------------------------
🔁 قائمة بروكسيات (جرب واحدة تلو الأخرى)
يمكنك تعديل أو إضافة بروكسيات عند الحاجة
------------------------------------------- */
const PROXIES = [
  "https://cors.caliph.my.id/",
  "https://cors.eu.org/",
  "https://thingproxy.freeboard.io/fetch/",
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

/* -------------------------------------------
مساعد لبناء رابط محاط بالبروكسي
يدعم السلاسل والدوال في PROXIES
------------------------------------------- */
function buildProxyUrl(originalUrl, proxy) {
  if (typeof proxy === "function") return proxy(originalUrl);
  const sep = proxy.endsWith("/") ? "" : "/";
  return `${proxy}${sep}${originalUrl.replace(/^https?:\/\//, "")}`;
}

/* -------------------------------------------
رفع الـ buffer إلى Catbox
------------------------------------------- */
async function uploadBufferToCatbox(buffer) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", buffer, {
    filename: "audio.mp3",
    contentType: "audio/mpeg",
  });

  const res = await axios.post("https://catbox.moe/user/api.php", form, {
    headers: form.getHeaders(),
    timeout: 60000,
  });

  return res.data;
}

/* -------------------------------------------
🎧 ElevenLabsTTS class (بدون Google fallback)
------------------------------------------- */
class ElevenLabsTTS {
  constructor() {
    this.apiKey = ELEVEN_API_KEY;
    this.baseUrl = "https://api.elevenlabs.io/v1/text-to-speech/";
    this.proxies = PROXIES;
  }

  async tryElevenDirect(voiceId, text) {
    const url = `${this.baseUrl}${voiceId}`;
    const body = { text, voice_settings: { stability: 0.7, similarity_boost: 0.9 } };
    return axios.post(url, body, {
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
      timeout: 30000,
      validateStatus: (s) => s < 500,
    });
  }

  async tryElevenViaProxy(proxyItem, voiceId, text) {
    const target = `${this.baseUrl}${voiceId}`;
    const proxied = buildProxyUrl(target, proxyItem);
    const body = { text, voice_settings: { stability: 0.7, similarity_boost: 0.9 } };

    return axios.post(proxied, body, {
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
      timeout: 35000,
      validateStatus: (s) => s < 500,
    });
  }

  async generate({ voiceId, text }) {
    let lastError = null;

    // 1) محاولة مباشرة
    try {
      const res = await this.tryElevenDirect(voiceId, text);
      // تحويل إلى نص آمن لفحص رسائل نصية مثل DEPLOYMENT_DISABLED
      const asText = Buffer.from(res.data || []).toString("utf8").toLowerCase();
      if (res.status === 402 || asText.includes("deployment_disabled") || asText.includes("payment required")) {
        throw new Error(`ElevenLabs: payment/deployment disabled (status ${res.status})`);
      }
      return await this._onSuccess(Buffer.from(res.data));
    } catch (e) {
      lastError = e;
    }

    // 2) تجربة عبر البروكسيات
    for (const p of this.proxies) {
      try {
        const pres = await this.tryElevenViaProxy(p, voiceId, text);
        const asText = Buffer.from(pres.data || []).toString("utf8").toLowerCase();
        if (pres.status === 402 || asText.includes("deployment_disabled") || asText.includes("payment required")) {
          // نعتبرها فشل ونكمل إلى البروكسي التالي
          lastError = new Error(`proxy responded with payment/deploy disabled (proxy ${p})`);
          continue;
        }
        return await this._onSuccess(Buffer.from(pres.data));
      } catch (e) {
        lastError = e;
        // استمر إلى البروكسي التالي
      }
    }

    // 3) فشل كل المحاولات -> ارجع خطأ واضح (بدون fallback خارجي)
    throw new Error(`فشل توليد الصوت عبر ElevenLabs و البروكسيات. آخر خطأ: ${lastError?.message || "Unknown"}`);
  }

  async _onSuccess(buffer) {
    // ارفع على Catbox
    const url = await uploadBufferToCatbox(buffer);
    return { url, mimetype: "audio/mpeg" };
  }
}

/* -------------------------------------------
Routes
------------------------------------------- */

/* POST /  { voice, text } */
router.post("/", async (req, res) => {
  try {
    const { voice, text } = req.body;
    if (!voice || !text) return res.json({ status: false, message: "ارسل voice و text" });

    const voiceObj = voices.find((v) => v.arName === voice);
    if (!voiceObj) return res.json({ status: false, message: "الصوت غير موجود" });

    const tts = new ElevenLabsTTS();
    const result = await tts.generate({ voiceId: voiceObj.id, text });

    res.json({ status: true, voice, url: result.url });
  } catch (e) {
    // حاول استخراج رسالة من e.response إذا موجودة
    let errMsg = e?.message || e?.toString?.() || "Unknown error";
    try {
      if (e.response && e.response.data) {
        const maybeText = Buffer.from(e.response.data).toString("utf8");
        if (maybeText) errMsg = `${errMsg} - response: ${maybeText.slice(0, 500)}`;
      }
    } catch (xx) {}
    res.json({ status: false, error: errMsg });
  }
});

/* GET /?voice=ليانا&text=مرحبا */
router.get("/", async (req, res) => {
  try {
    const { voice, text } = req.query;
    if (!voice || !text) return res.json({ status: false, message: "ارسل voice و text" });

    const voiceObj = voices.find((v) => v.arName === voice);
    if (!voiceObj) return res.json({ status: false, message: "الصوت غير موجود" });

    const tts = new ElevenLabsTTS();
    const result = await tts.generate({ voiceId: voiceObj.id, text });

    res.json({ status: true, voice, url: result.url });
  } catch (e) {
    let errMsg = e?.message || e?.toString?.() || "Unknown error";
    try {
      if (e.response && e.response.data) {
        const maybeText = Buffer.from(e.response.data).toString("utf8");
        if (maybeText) errMsg = `${errMsg} - response: ${maybeText.slice(0, 500)}`;
      }
    } catch (xx) {}
    res.json({ status: false, error: errMsg });
  }
});

/* GET /voices */
router.get("/voices", (req, res) => {
  res.json({ status: true, voices });
});

export default router;