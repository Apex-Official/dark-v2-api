// api/anime.js
import axios from "axios";

export default async function handler(req, res) {
  const animeName = req.query.q?.trim();

  if (!animeName) {
    return res.status(400).json({
      status: "error",
      message: "الرجاء إدخال اسم الأنمي باستخدام ?q=<اسم الأنمي>",
    });
  }

  try {
    const searchParams = {
      _offset: 0,
      _limit: 30,
      _order_by: "latest_first",
      list_type: "filter",
      anime_name: animeName,
      just_info: "Yes",
    };

    const jsonParam = encodeURIComponent(JSON.stringify(searchParams));

    const apiUrl = `https://anslayer.com/anime/public/animes/get-published-animes?json=${jsonParam}`;

    const response = await axios.get(apiUrl, {
      headers: {
        "User-Agent": "okhttp/3.12.13",
        "Accept": "application/json",
        "client-id": "android-app2",
        "client-secret": "7befba6263cc14c90d2f1d6da2c5cf9b251bfbbd",
      },
      timeout: 30000,
    });

    // إعادة JSON كما هو
    res.status(200).json(response.data);

  } catch (err) {
    console.error("ANIME_API_ERROR:", err);

    res.status(500).json({
      status: "error",
      message: "حدث خطأ أثناء جلب البيانات من API الأصلي",
      error: err.message,
    });
  }
}