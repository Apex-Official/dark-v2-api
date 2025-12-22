import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import FormData from "form-data";

const router = express.Router();

// ==================== Utility Functions ====================
function sanitizeFilename(name = "track") {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

function parseSpotifyUrl(input) {
  const url = input.trim();
  
  if (url.includes('spotify.link')) {
    throw new Error('⚠️ الروابط المختصرة (spotify.link) غير مدعومة. استخدم الرابط الكامل من open.spotify.com');
  }
  
  let trackMatch = url.match(/\/track\/([a-zA-Z0-9]+)/);
  if (trackMatch) {
    return { id: trackMatch[1], type: 'track' };
  }
  
  let playlistMatch = url.match(/\/playlist\/([a-zA-Z0-9]+)/);
  if (playlistMatch) {
    return { id: playlistMatch[1], type: 'playlist' };
  }
  
  let albumMatch = url.match(/\/album\/([a-zA-Z0-9]+)/);
  if (albumMatch) {
    return { id: albumMatch[1], type: 'album' };
  }
  
  throw new Error('❌ رابط Spotify غير صالح!');
}

// ==================== Source 1: sssspotify.com ====================
async function source1_sssspotify(url) {
  try {
    const { data } = await axios.post(
      'https://sssspotify.com/api/download/get-url',
      { url },
      {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        timeout: 30000
      }
    );

    if (data.code !== 200) {
      throw new Error('فشل الحصول على البيانات');
    }

    return {
      source: 'sssspotify',
      title: data.title,
      artist: data.authorName,
      cover: data.coverUrl,
      downloadUrl: `https://sssspotify.com${data.originalVideoUrl}`
    };
  } catch (err) {
    throw new Error(`Source1 (sssspotify): ${err.message}`);
  }
}

// ==================== Source 2: spotmate.online ====================
async function source2_spotmate(url) {
  try {
    const rynn = await axios.get('https://spotmate.online/', {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });
    
    const $ = cheerio.load(rynn.data);
    
    const api = axios.create({
      baseURL: 'https://spotmate.online',
      headers: {
        cookie: rynn.headers['set-cookie']?.join('; ') || '',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0',
        'x-csrf-token': $('meta[name="csrf-token"]').attr('content')
      },
      timeout: 30000
    });
    
    const [{ data: meta }, { data: dl }] = await Promise.all([
      api.post('/getTrackData', { spotify_url: url }),
      api.post('/convert', { urls: url })
    ]);
    
    return {
      source: 'spotmate',
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      cover: meta.cover || meta.image,
      duration: meta.duration,
      releaseDate: meta.release_date,
      downloadUrl: dl.url
    };
  } catch (err) {
    throw new Error(`Source2 (spotmate): ${err.message}`);
  }
}

// ==================== Source 3: spotisaver.net ====================
async function source3_spotisaver(url) {
  try {
    const { id, type } = parseSpotifyUrl(url);
    const referer = `https://spotisaver.net/en/${type}/${id}/`;
    const apiUrl = `https://spotisaver.net/api/get_playlist.php?id=${id}&type=${type}&lang=en`;
    
    const res = await axios.get(apiUrl, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0',
        'Referer': referer,
        'Accept': 'application/json'
      }, 
      timeout: 30000 
    });
    
    if (res.data.error) {
      throw new Error(res.data.error);
    }
    
    const tracks = res.data?.tracks || [];
    if (!tracks || tracks.length === 0) {
      throw new Error('لم يتم العثور على مسارات');
    }
    
    const track = tracks[0];
    
    const payload = {
      track,
      download_dir: "downloads",
      filename_tag: "SPOTISAVER",
      user_ip: "0.0.0.0",
      is_premium: false
    };

    const downloadRes = await axios.post(
      "https://spotisaver.net/api/download_track.php",
      payload,
      {
        headers: { 
          'User-Agent': 'Mozilla/5.0',
          'Referer': `https://spotisaver.net/en/track/${track.id}/`,
          'Content-Type': 'application/json'
        },
        responseType: "arraybuffer",
        timeout: 60000
      }
    );

    const buffer = Buffer.from(downloadRes.data);
    
    if (buffer.length < 1000) {
      throw new Error('حجم الملف صغير جداً');
    }

    return {
      source: 'spotisaver',
      title: track.name,
      artist: track.artists?.map(a => a.name).join(', '),
      album: track.album,
      cover: track.album_art,
      buffer: buffer,
      isBuffer: true
    };
  } catch (err) {
    throw new Error(`Source3 (spotisaver): ${err.message}`);
  }
}

// ==================== Source 4: spotifydown.org ====================
async function source4_spotifydown(url) {
  try {
    const form = new FormData();
    form.append('url', url);

    const headers = {
      ...form.getHeaders(),
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://spotifydown.org/',
    };

    const { data } = await axios.post('https://spotifydown.org/result.php', form, { 
      headers,
      timeout: 30000
    });
    
    const $ = cheerio.load(data);
    const downloadLink = $('a.dlbtnhigh').attr('href');
    
    if (!downloadLink) {
      throw new Error('لم يتم العثور على رابط التحميل');
    }

    const title = $('.song-title').text() || 'Unknown';
    const artist = $('.artist-name').text() || 'Unknown';

    return {
      source: 'spotifydown',
      title: title,
      artist: artist,
      downloadUrl: downloadLink
    };
  } catch (err) {
    throw new Error(`Source4 (spotifydown): ${err.message}`);
  }
}

// ==================== Main Download Function with Fallback ====================
async function downloadSpotify(url) {
  const sources = [
    { name: 'sssspotify', func: source1_sssspotify },
    { name: 'spotmate', func: source2_spotmate },
    { name: 'spotisaver', func: source3_spotisaver },
    { name: 'spotifydown', func: source4_spotifydown }
  ];

  const errors = [];

  for (const source of sources) {
    try {
      console.log(`🔄 جاري المحاولة مع: ${source.name}...`);
      const result = await source.func(url);
      console.log(`✅ نجح التحميل من: ${source.name}`);
      return result;
    } catch (err) {
      console.error(`❌ فشل ${source.name}: ${err.message}`);
      errors.push(`${source.name}: ${err.message}`);
      continue;
    }
  }

  throw new Error(`فشلت جميع المصادر:\n${errors.join('\n')}`);
}

// ==================== GET Route ====================
router.get("/", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ رابط Spotify مطلوب (url parameter)" 
      });
    }

    if (!url.includes('spotify.com')) {
      return res.status(400).json({ 
        status: false, 
        message: "❌ الرابط يجب أن يكون من Spotify" 
      });
    }

    const result = await downloadSpotify(url);

    res.json({
      status: true,
      message: "✅ تم الحصول على البيانات بنجاح",
      source: result.source,
      data: {
        title: result.title,
        artist: result.artist,
        album: result.album || null,
        cover: result.cover || null,
        duration: result.duration || null,
        releaseDate: result.releaseDate || null,
        downloadUrl: result.isBuffer ? null : result.downloadUrl,
        isBuffer: result.isBuffer || false,
        filename: sanitizeFilename(result.title) + ".mp3"
      }
    });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ", 
      error: err.message 
    });
  }
});

// ==================== POST Route ====================
router.post("/", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ 
        status: false, 
        message: "⚠️ رابط Spotify مطلوب في body" 
      });
    }

    if (!url.includes('spotify.com')) {
      return res.status(400).json({ 
        status: false, 
        message: "❌ الرابط يجب أن يكون من Spotify" 
      });
    }

    const result = await downloadSpotify(url);

    res.json({
      status: true,
      message: "✅ تم الحصول على البيانات بنجاح",
      source: result.source,
      data: {
        title: result.title,
        artist: result.artist,
        album: result.album || null,
        cover: result.cover || null,
        duration: result.duration || null,
        releaseDate: result.releaseDate || null,
        downloadUrl: result.isBuffer ? null : result.downloadUrl,
        isBuffer: result.isBuffer || false,
        filename: sanitizeFilename(result.title) + ".mp3"
      }
    });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ 
      status: false, 
      message: "❌ حدث خطأ", 
      error: err.message 
    });
  }
});

export default router;