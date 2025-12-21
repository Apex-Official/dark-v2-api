import express from "express";
import axios from "axios";

const router = express.Router();

/**
 * دالة لتنزيل محتوى من Threads
 */
async function threads(url) {
  const { data } = await axios.get(
    `https://threadsphotodownloader.com/download?url=${encodeURIComponent(url)}`,
    {
      headers: {
        'authority': 'threadsphotodownloader.com',
        'accept': '*/*',
        'next-url': '/en',
        'referer': 'https://threadsphotodownloader.com/',
        'rsc': '1',
        'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
      },
      responseType: 'text'
    }
  );

  const html = data.toString();

  const imgMatch = html.match(/"imageUrl":\[(.*?)\]/s);
  const image = imgMatch ? (imgMatch[1].match(/"([^"]+)"/g) || []).map(v => v.replace(/"/g, '')) : [];

  const vidMatch = html.match(/"videoUrl":\[(.*?)\]/s);
  let video = [];

  if (vidMatch) {
    const raw = vidMatch[1];
    const str = raw.match(/"([^"]+\.mp4[^"]*)"/g);
    if (str) video = str.map(v => v.replace(/"/g, ''));
    const obj = raw.match(/"download_url":"([^"]+)"/);
    if (obj) video.push(obj[1]);
  }

  return { image, video };
}

/** 🧩 POST Route - تنزيل من Threads */
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "❌ الرجاء إدخال رابط Threads",
        example: "https://www.threads.com/@username/post/xxxxx"
      });
    }

    // التحقق من صحة الرابط
    if (!url.includes('threads.com')) {
      return res.status(400).json({
        status: false,
        message: "❌ الرجاء إدخال رابط Threads صحيح"
      });
    }

    const result = await threads(url);

    if (result.image.length === 0 && result.video.length === 0) {
      return res.status(404).json({
        status: false,
        message: "❌ لم يتم العثور على وسائط في هذا المنشور"
      });
    }

    res.json({
      status: true,
      message: "✅ تم التنزيل بنجاح",
      data: {
        images: result.image,
        videos: result.video,
        total: result.image.length + result.video.length
      }
    });

  } catch (error) {
    console.error("Threads Download Error:", error);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التنزيل من Threads",
      error: error.message
    });
  }
});

/** 🧩 GET Route - تنزيل من Threads */
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "❌ الرجاء إدخال رابط Threads",
        example: "/threads?url=https://www.threads.com/@username/post/xxxxx"
      });
    }

    // التحقق من صحة الرابط
    if (!url.includes('threads.com')) {
      return res.status(400).json({
        status: false,
        message: "❌ الرجاء إدخال رابط Threads صحيح"
      });
    }

    const result = await threads(url);

    if (result.image.length === 0 && result.video.length === 0) {
      return res.status(404).json({
        status: false,
        message: "❌ لم يتم العثور على وسائط في هذا المنشور"
      });
    }

    res.json({
      status: true,
      message: "✅ تم التنزيل بنجاح",
      data: {
        images: result.image,
        videos: result.video,
        total: result.image.length + result.video.length
      }
    });

  } catch (error) {
    console.error("Threads Download Error:", error);
    res.status(500).json({
      status: false,
      message: "❌ حدث خطأ أثناء التنزيل من Threads",
      error: error.message
    });
  }
});

export default router;