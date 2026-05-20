const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const axios = require('axios');
const tobyg = require('@tobyg74/tiktok-api-dl');
const ffmpeg = require('ffmpeg-static');

// SORUN 1 DÜZELTME: İşletim sistemine göre yt-dlp binary dosyasını belirleme (Windows için .exe, Linux için uzantısız)
const isWindows = process.platform === 'win32';
const ytDlpBin = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const ytDlpPath = path.join(__dirname, ytDlpBin);

// SORUN 7 DÜZELTME: Production ortamında ALLOWED_DOMAINS kontrolü
if (process.env.NODE_ENV === 'production' && !process.env.ALLOWED_DOMAINS) {
  console.warn('UYARI: Production modunda ALLOWED_DOMAINS tanımlanmamış! CORS tüm domainlere açık.');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure temp directory exists for merging high-quality videos locally
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Enable HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Custom In-Memory Rate Limiter middleware
const ipRequestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 35; // Allow 35 API downloads per 15 minutes

function rateLimiter(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();

  if (!ipRequestCounts.has(ip)) {
    ipRequestCounts.set(ip, []);
  }

  const timestamps = ipRequestCounts.get(ip).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  ipRequestCounts.set(ip, timestamps);

  if (timestamps.length > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ 
      error: 'Çok fazla istek gönderdiniz. Lütfen 15 dakika sonra tekrar deneyin. / Too many requests, please try again in 15 minutes.' 
    });
  }
  next();
}

// Enable CORS with production restriction
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
if (process.env.ALLOWED_DOMAINS) {
  process.env.ALLOWED_DOMAINS.split(',').forEach(d => allowedOrigins.push(d.trim()));
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
}));

app.use(express.json());

// Serve static frontend files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// URL Safety sanitizer to prevent SSRF (Server-Side Request Forgery)
function isUrlSafe(inputUrl) {
  try {
    const parsed = new URL(inputUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    if (process.env.NODE_ENV === 'production' && isLocalhost) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

// Helper to run local yt-dlp binary (SORUN 1: Global ytDlpPath değişkeni kullanılıyor)
function runYtDlp(url) {
  return new Promise((resolve, reject) => {
    execFile(ytDlpPath, ['--dump-json', '--no-warnings', '--no-playlist', url], (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || error.message));
      }
      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (err) {
        reject(new Error('Failed to parse yt-dlp output JSON.'));
      }
    });
  });
}

// Fallback to Cobalt API instances
async function fetchFromCobalt(url, quality = '720') {
  const cobaltInstances = [
    'https://cobaltapi.kittycat.boo/',
    'https://cobaltapi.squair.xyz/',
    'https://fox.kittycat.boo/',
    'https://api.cobalt.blackcat.sweeux.org/'
  ];

  for (const host of cobaltInstances) {
    try {
      const postData = {
        url: url,
        filenamePattern: 'basic'
      };
      if (quality === 'audio') {
        postData.downloadMode = 'audio';
      } else {
        postData.videoQuality = quality;
      }

      const response = await axios.post(host, postData, {
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json'
        },
        timeout: 6000
      });

      if (response.data && response.data.url) {
        return {
          title: response.data.filename || 'Downloaded Video',
          url: response.data.url,
          source: 'Cobalt API',
          status: 'success'
        };
      }
    } catch (err) {
      console.log(`Cobalt host ${host} failed:`, err.message);
    }
  }
  throw new Error('All fallback API servers failed to process this link.');
}

// Format duration to hh:mm:ss or mm:ss
function formatDuration(durationSecs) {
  if (!durationSecs) return 'N/A';
  const duration = Math.round(durationSecs);
  const hrs = Math.floor(duration / 3600);
  const mins = Math.floor((duration % 3600) / 60);
  const secs = duration % 60;
  
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

// Convert bytes to formatted MB string
function formatBytes(bytes) {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

// Get the exact format file size, estimating from bitrate and duration if missing (YouTube adaptive streams)
function getFormatSize(format, duration) {
  if (!format) return 0;
  if (format.filesize) return format.filesize;
  if (format.filesize_approx) return format.filesize_approx;
  
  // Dynamic bitrate estimation: size = (bitrate_kbps * 1000 * duration_secs) / 8
  const bitrate = format.tbr || (format.vbr + (format.abr || 0)) || 0;
  if (bitrate > 0 && duration > 0) {
    return Math.round((bitrate * 1000 * duration) / 8);
  }
  return 0;
}

// Query file size using HEAD / range request with short timeout
async function getRemoteFileSize(url) {
  if (!url) return 'N/A';
  try {
    const response = await axios.head(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': url.includes('tiktok') ? 'https://www.tiktok.com/' : (url.includes('instagram') ? 'https://www.instagram.com/' : '')
      },
      timeout: 3000
    });
    const len = response.headers['content-length'];
    if (len) {
      return formatBytes(parseInt(len));
    }
  } catch (err) {
    // Try Range request fallback
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Range': 'bytes=0-0',
          'Referer': url.includes('tiktok') ? 'https://www.tiktok.com/' : (url.includes('instagram') ? 'https://www.instagram.com/' : '')
        },
        timeout: 3000
      });
      const contentRange = response.headers['content-range'];
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)/);
        if (match) {
          return formatBytes(parseInt(match[1]));
        }
      }
    } catch (e) {
      // fail silently
    }
  }
  return 'N/A';
}

app.post('/api/download', rateLimiter, async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required.' });
  }

  if (!isUrlSafe(url)) {
    return res.status(400).json({ error: 'Geçersiz veya engellenmiş bağlantı adresi. / Invalid or unsafe URL link.' });
  }

  console.log(`Processing URL: ${url}`);

  let platform = 'unknown';
  const lowercaseUrl = url.toLowerCase();

  if (lowercaseUrl.includes('youtube.com') || lowercaseUrl.includes('youtu.be')) {
    platform = 'youtube';
  } else if (lowercaseUrl.includes('tiktok.com')) {
    platform = 'tiktok';
  } else if (lowercaseUrl.includes('instagram.com')) {
    platform = 'instagram';
  }

  // ------------------ TIKTOK SPECIFIC LOGIC ------------------
  if (platform === 'tiktok') {
    try {
      console.log('Attempting TikTok download with yt-dlp...');
      const info = await runYtDlp(url);
      const size = formatBytes(info.filesize || info.filesize_approx) || await getRemoteFileSize(info.url);
      
      return res.json({
        title: info.title || 'TikTok Video',
        thumbnail: info.thumbnail || '',
        duration: formatDuration(info.duration),
        platform: 'tiktok',
        author: info.uploader || 'TikTok Creator',
        width: info.width || null,
        height: info.height || null,
        downloads: [
          {
            quality: 'HD Video (No Watermark)',
            url: info.url,
            ext: 'mp4',
            type: 'video',
            size: size
          }
        ]
      });
    } catch (err) {
      console.log('TikTok yt-dlp failed:', err.message);
    }

    try {
      console.log('Attempting TikTok download with tobyg package...');
      const result = await tobyg.Downloader(url, { version: 'v1' });
      if (result && result.status === 'success' && result.result) {
        const video = result.result;
        const videoUrl = video.video && video.video.noWatermark ? video.video.noWatermark : (video.video && video.video.noWatermark2 ? video.video.noWatermark2 : '');
        const audioUrl = video.music && video.music.playUrl ? video.music.playUrl : '';
        
        const videoSize = video.video && video.video.size ? formatBytes(video.video.size) : await getRemoteFileSize(videoUrl);
        const audioSize = await getRemoteFileSize(audioUrl);

        return res.json({
          title: video.desc || 'TikTok Video',
          thumbnail: video.video ? video.video.cover : '',
          duration: 'N/A',
          platform: 'tiktok',
          author: video.author ? video.author.nickname : 'TikTok Creator',
          width: (video.video && video.video.width) || null,
          height: (video.video && video.video.height) || null,
          downloads: [
            {
              quality: 'HD Video (No Watermark)',
              url: videoUrl,
              ext: 'mp4',
              type: 'video',
              size: videoSize
            },
            {
              quality: 'Audio Only',
              url: audioUrl,
              ext: 'mp3',
              type: 'audio',
              size: audioSize
            }
          ].filter(item => item.url)
        });
      }
    } catch (err) {
      console.log('TobyG TikTok Downloader failed:', err.message);
    }

    try {
      console.log('Attempting TikTok download with Cobalt API fallback...');
      const cobaltData = await fetchFromCobalt(url, 'max');
      const size = await getRemoteFileSize(cobaltData.url);
      return res.json({
        title: cobaltData.title,
        thumbnail: '',
        duration: 'N/A',
        platform: 'tiktok',
        author: 'TikTok Creator',
        downloads: [
          {
            quality: 'HD Video (Cobalt)',
            url: cobaltData.url,
            ext: 'mp4',
            type: 'video',
            size: size
          }
        ]
      });
    } catch (err) {
      console.log('Cobalt TikTok failed:', err.message);
    }

    return res.status(500).json({ error: 'TikTok indirme bağlantısı alınamadı. Platform şu anda istekleri engelliyor olabilir.' });
  }

  // ------------------ INSTAGRAM SPECIFIC LOGIC ------------------
  if (platform === 'instagram') {
    try {
      console.log('Attempting Instagram download with yt-dlp...');
      const info = await runYtDlp(url);
      const size = formatBytes(info.filesize || info.filesize_approx) || await getRemoteFileSize(info.url);
      return res.json({
        title: info.title || 'Instagram Post',
        thumbnail: info.thumbnail || '',
        duration: formatDuration(info.duration),
        platform: 'instagram',
        author: info.uploader || 'Instagram User',
        width: info.width || null,
        height: info.height || null,
        downloads: [
          {
            quality: 'HD Video',
            url: info.url,
            ext: 'mp4',
            type: 'video',
            size: size
          }
        ]
      });
    } catch (err) {
      console.log('Instagram yt-dlp failed:', err.message);
    }

    try {
      console.log('Attempting Instagram download with Cobalt API...');
      const cobaltData = await fetchFromCobalt(url, 'max');
      const size = await getRemoteFileSize(cobaltData.url);
      return res.json({
        title: cobaltData.title,
        thumbnail: '',
        duration: 'N/A',
        platform: 'instagram',
        author: 'Instagram User',
        downloads: [
          {
            quality: 'HD Video (Cobalt)',
            url: cobaltData.url,
            ext: 'mp4',
            type: 'video',
            size: size
          }
        ]
      });
    } catch (err) {
      console.log('Cobalt Instagram failed:', err.message);
    }

    return res.status(500).json({ error: 'Instagram indirme bağlantısı alınamadı. Gönderinin gizli olmadığından emin olun.' });
  }

  // ------------------ YOUTUBE SPECIFIC LOGIC ------------------
  if (platform === 'youtube') {
    try {
      console.log('Attempting YouTube download with yt-dlp...');
      const info = await runYtDlp(url);
      
      const downloads = [];
      
      // Determine unique video qualities supported
      const combinedFormats = info.formats.filter(f => f.vcodec !== 'none' && f.acodec !== 'none');
      const videoOnlyFormats = info.formats.filter(f => f.vcodec !== 'none' && f.acodec === 'none');
      const audioFormats = info.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');
      
      // Target resolutions to offer
      const targetHeights = [1080, 720, 480, 360];
      
      // Sort audio formats by quality/bitrate descending to accurately match what yt-dlp will select
      const sortedAudio = audioFormats.sort((a, b) => {
        const abrA = a.abr || 0;
        const abrB = b.abr || 0;
        return abrB - abrA;
      });
      // Prioritize standard high-quality m4a (aac) stream (format 140)
      const bestAudio = sortedAudio.find(f => f.ext === 'm4a') || sortedAudio[0];
      const audioSize = getFormatSize(bestAudio, info.duration);

      for (const height of targetHeights) {
        // Find if this video supports this quality
        const hasCombined = combinedFormats.some(f => f.height === height);
        const hasVideoOnly = videoOnlyFormats.some(f => f.height === height);
        
        if (hasCombined || hasVideoOnly) {
          // Get all available video formats for this height, sort them by bitrate descending
          const matchingFormats = info.formats.filter(f => f.height === height && f.vcodec !== 'none');
          const sortedMatching = matchingFormats.sort((a, b) => {
            const bitrateA = a.tbr || (a.vbr || 0);
            const bitrateB = b.tbr || (b.vbr || 0);
            return bitrateB - bitrateA;
          });
          
          // Downloader targets MP4 format first
          const matchingFormat = sortedMatching.find(f => f.ext === 'mp4') || sortedMatching[0];
          const videoSize = getFormatSize(matchingFormat, info.duration);
          
          // Total approximate size (video + audio)
          const isCombinedFormat = matchingFormat && matchingFormat.acodec !== 'none';
          const totalSize = isCombinedFormat ? videoSize : (videoSize ? videoSize + audioSize : 0);

          downloads.push({
            quality: `${height}p (${height >= 720 ? 'Full HD' : 'SD'})`,
            qualityKey: String(height),
            ext: 'mp4',
            type: 'video',
            size: totalSize ? formatBytes(totalSize) : 'N/A'
          });
        }
      }

      // Fallback combined if list is empty
      if (downloads.length === 0 && info.url) {
        downloads.push({
          quality: 'Video (HD)',
          qualityKey: '720',
          ext: 'mp4',
          type: 'video',
          size: formatBytes(getFormatSize(info, info.duration)) || 'N/A'
        });
      }

      // Add Audio option
      if (bestAudio) {
        downloads.push({
          quality: 'Ses (MP3/M4A)',
          qualityKey: 'audio',
          ext: 'mp3',
          type: 'audio',
          size: audioSize ? formatBytes(audioSize) : 'N/A'
        });
      }

      return res.json({
        title: info.title || 'YouTube Video',
        thumbnail: info.thumbnail || '',
        duration: formatDuration(info.duration),
        platform: 'youtube',
        author: info.uploader || 'YouTube Channel',
        width: info.width || null,
        height: info.height || null,
        downloads: downloads
      });
    } catch (err) {
      console.log('YouTube yt-dlp failed:', err.message);
    }

    // Cobalt API Fallback
    try {
      console.log('Attempting YouTube download with Cobalt API fallback...');
      const cobaltData = await fetchFromCobalt(url, '720');
      const size = await getRemoteFileSize(cobaltData.url);
      return res.json({
        title: cobaltData.title,
        thumbnail: '',
        duration: 'N/A',
        platform: 'youtube',
        author: 'YouTube Creator',
        downloads: [
          {
            quality: 'Video (HD 720p)',
            qualityKey: '720',
            ext: 'mp4',
            type: 'video',
            size: size
          },
          {
            quality: 'Video (SD 360p)',
            qualityKey: '360',
            ext: 'mp4',
            type: 'video',
            size: 'N/A'
          },
          {
            quality: 'Ses (MP3)',
            qualityKey: 'audio',
            ext: 'mp3',
            type: 'audio',
            size: 'N/A'
          }
        ]
      });
    } catch (err) {
      console.log('Cobalt YouTube failed:', err.message);
    }

    return res.status(500).json({ error: 'YouTube video bilgileri çekilemedi. Lütfen bağlantıyı kontrol edip tekrar deneyin.' });
  }

  // ------------------ OTHER PLATFORMS ------------------
  try {
    console.log('Attempting generic platform download with yt-dlp...');
    const info = await runYtDlp(url);
    const size = formatBytes(getFormatSize(info, info.duration)) || await getRemoteFileSize(info.url);
    return res.json({
      title: info.title || 'Web Video',
      thumbnail: info.thumbnail || '',
      duration: formatDuration(info.duration),
      platform: 'unknown',
      author: info.uploader || 'Web Creator',
      downloads: [
        {
          quality: 'Download Video',
          url: info.url,
          ext: 'mp4',
          type: 'video',
          size: size
        }
      ].filter(item => item.url)
    });
  } catch (err) {
    console.log('Generic yt-dlp failed:', err.message);
  }

  return res.status(400).json({ error: 'Desteklenmeyen web sitesi veya bağlantı kısıtlaması.' });
});

// In-memory sessions to keep track of downloads in progress
const downloadSessions = {};

// Periodic cleanup for dead temp files and sessions
setInterval(() => {
  const now = Date.now();
  for (const id in downloadSessions) {
    const session = downloadSessions[id];
    const sessionTime = parseInt(id.split('_')[1]);
    if (isNaN(sessionTime) || now - sessionTime > 20 * 60 * 1000) {
      console.log(`Cleaning up expired download session: ${id}`);
      if (session.childProcess) {
        try { session.childProcess.kill('SIGKILL'); } catch (e) {}
      }
      if (session.tempFilePath && fs.existsSync(session.tempFilePath)) {
        try { fs.unlinkSync(session.tempFilePath); } catch (e) {}
      }
      delete downloadSessions[id];
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

app.post('/api/download-start', rateLimiter, (req, res) => {
  const { url, quality, platform, filename } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL parametresi gereklidir.' });
  }

  if (!isUrlSafe(url)) {
    return res.status(400).json({ error: 'Geçersiz veya engellenmiş bağlantı adresi. / Invalid or unsafe URL link.' });
  }

  const downloadId = 'dl_' + Date.now() + '_' + Math.random().toString(36).substring(7);
  const isAudio = filename && filename.toLowerCase().endsWith('.mp3');
  const finalFilename = filename ? filename : `download_${Date.now()}.${isAudio ? 'mp3' : 'mp4'}`;

  // Register session state
  downloadSessions[downloadId] = {
    status: 'starting',
    progress: 0,
    tempFilePath: null,
    filename: finalFilename,
    isAudio: isAudio,
    childProcess: null
  };

  // SORUN 3 DÜZELTME: 30 dakika sonra session'ı bellekten ve diskten temizleyen zamanlayıcı
  setTimeout(() => {
    const session = downloadSessions[downloadId];
    if (session?.tempFilePath && fs.existsSync(session.tempFilePath)) {
      fs.unlink(session.tempFilePath, () => {});
    }
    delete downloadSessions[downloadId];
  }, 30 * 60 * 1000);

  let formatStr = 'best';
  
  if (platform === 'youtube') {
    if (quality === 'audio') {
      formatStr = 'bestaudio[ext=m4a]/bestaudio/best';
    } else if (quality && quality !== 'best') {
      // Prioritizes standard size-optimized MP4 H.264 video streams and AAC M4A audio streams,
      // avoiding massive VP9/AV1 codecs unless no MP4 format is available.
      formatStr = `bestvideo[height<=${quality}][vcodec*=avc1]+bestaudio[ext=m4a]/bestvideo[height<=${quality}][vcodec*=h264]+bestaudio[ext=m4a]/bestvideo[height<=${quality}][vcodec*=avc1]+bestaudio/bestvideo[height<=${quality}][vcodec*=h264]+bestaudio/best[height<=${quality}][vcodec*=avc1]/best[height<=${quality}][vcodec*=h264]/best[height<=${quality}]/best`;
    }
  } else {
    // For Instagram and TikTok, prioritize H.264 video and AAC audio to prevent unplayable H.265/AV1 streams
    formatStr = 'bestvideo[vcodec*=h264]+bestaudio[acodec^=mp4a]/bestvideo[vcodec*=avc1]+bestaudio[ext=m4a]/bestvideo[vcodec*=h264]+bestaudio/bestvideo[vcodec*=avc1]+bestaudio/best[vcodec*=h264]/best[vcodec*=avc1]/best[ext=mp4]/best';
  }

  const fileExt = isAudio ? 'mp3' : 'mp4';
  const tempFilePath = path.join(tempDir, `temp_${downloadId}.${fileExt}`);
  downloadSessions[downloadId].tempFilePath = tempFilePath;

  // Speed-optimized arguments:
  // 1. --concurrent-fragments 5: Downloads multiple fragments in parallel (speeds up DASH streams).
  // 2. --throttled-rate 100K: Reconnects automatically if YouTube limits/throttles download speeds.
  // 3. --recode-video mp4: Failsafe to transcode any non-H264 stream to H.264/AAC for universal compatibility.
  const args = [
    '-f', formatStr,
    '--no-playlist',
    '--no-warnings',
    '--ffmpeg-location', ffmpeg,
    '--merge-output-format', 'mp4'
  ];

  if (!isAudio) {
    args.push('--recode-video', 'mp4');
  }

  args.push(
    '--concurrent-fragments', '5',
    '--throttled-rate', '100K',
    '-o', tempFilePath,
    url
  );

  console.log(`Starting background download session ${downloadId} for: ${url} (Quality: ${quality})`);
  const child = spawn(ytDlpPath, args);
  downloadSessions[downloadId].childProcess = child;

  // Track progress from stdout
  child.stdout.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
    if (match) {
      downloadSessions[downloadId].progress = parseFloat(match[1]);
      downloadSessions[downloadId].status = 'downloading';
    }
    if (text.includes('[Merger]') || text.includes('Merging formats')) {
      downloadSessions[downloadId].status = 'merging';
    }
  });

  // Track progress from stderr
  child.stderr.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
    if (match) {
      downloadSessions[downloadId].progress = parseFloat(match[1]);
      downloadSessions[downloadId].status = 'downloading';
    }
    if (text.includes('[Merger]') || text.includes('Merging formats')) {
      downloadSessions[downloadId].status = 'merging';
    }
  });

  child.on('close', (code) => {
    const session = downloadSessions[downloadId];
    if (!session) return;

    if (code === 0 && fs.existsSync(tempFilePath)) {
      console.log(`Background download session ${downloadId} completed successfully.`);
      session.status = 'completed';
      session.progress = 100;
    } else {
      console.error(`Background download session ${downloadId} failed. Exit code: ${code}`);
      session.status = 'failed';
      session.error = 'Video birleştirme veya indirme hatası oluştu.';
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
    }
  });

  child.on('error', (err) => {
    console.error(`Failed to spawn download process for session ${downloadId}:`, err);
    const session = downloadSessions[downloadId];
    if (session) {
      session.status = 'failed';
      session.error = err.message;
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch (e) {}
      }
    }
  });

  return res.json({ downloadId });
});

// 3. API: Polling progress endpoint
app.get('/api/download-progress', (req, res) => {
  const { id } = req.query;
  const session = downloadSessions[id];

  if (!session) {
    return res.status(404).json({ error: 'İndirme oturumu bulunamadı veya süresi dolmuş.' });
  }

  res.json({
    status: session.status,
    progress: session.progress,
    error: session.error
  });
});

// 4. API: Retrieve the fully merged video file
app.get('/api/download-retrieve', (req, res) => {
  const { id } = req.query;
  const session = downloadSessions[id];

  if (!session || session.status !== 'completed' || !fs.existsSync(session.tempFilePath)) {
    return res.status(404).send('Dosya henüz hazır değil, bulunamadı veya süresi dolmuş.');
  }

  const tempFilePath = session.tempFilePath;
  const filename = session.filename;
  const safeFilename = encodeURIComponent(filename);

  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFilename}`);
  res.setHeader('Content-Type', session.isAudio ? 'audio/mpeg' : 'video/mp4');

  const stats = fs.statSync(tempFilePath);
  res.setHeader('Content-Length', stats.size);

  res.sendFile(tempFilePath, (err) => {
    if (err) {
      console.error(`Error sending session file ${id}:`, err.message);
    }
    // Delete the file after it finishes downloading to save disk space
    fs.unlink(tempFilePath, (unlinkErr) => {
      if (unlinkErr) console.error('Error deleting temp file after retrieval:', unlinkErr);
      else console.log(`Successfully cleaned up session file ${id}.`);
    });
    // Remove the session from memory
    delete downloadSessions[id];
  });
});

// 5. API: Direct media streaming proxy for TikTok and Instagram
app.get('/api/download-stream', async (req, res) => {
  let { url, filename } = req.query;

  if (!url) {
    return res.status(400).send('URL parametresi gereklidir.');
  }

  // SORUN 4 DÜZELTME: SSRF koruması
  if (!isUrlSafe(url)) {
    return res.status(400).send('Geçersiz veya güvensiz URL.');
  }

  const isAudio = filename && filename.toLowerCase().endsWith('.mp3');
  const finalFilename = filename ? encodeURIComponent(filename) : `download_${Date.now()}.${isAudio ? 'mp3' : 'mp4'}`;
  
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${finalFilename}`);
  res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : 'video/mp4');

  // TikTok and Instagram use standard combined CDN links. We proxy them directly.
  console.log(`Streaming proxy connection started for direct URL: ${url.substring(0, 80)}...`);

  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        'Referer': url.includes('tiktok') ? 'https://www.tiktok.com/' : (url.includes('instagram') ? 'https://www.instagram.com/' : '')
      }
    });

    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    response.data.pipe(res);

    response.data.on('error', (err) => {
      console.error('Error during media stream piping:', err.message);
    });

  } catch (err) {
    console.error('Proxy Streaming failed:', err.message);
    if (!res.headersSent) {
      res.status(500).send(`Dosya akışı indirilemedi: ${err.message}`);
    }
  }
});

// 6. API: Image proxy to bypass Instagram and TikTok hotlink protection and CORS
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('URL parametresi gereklidir.');
  }

  // SORUN 4 DÜZELTME: SSRF koruması
  if (!isUrlSafe(url)) {
    return res.status(400).send('Geçersiz veya güvensiz URL.');
  }

  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': url.includes('instagram') ? 'https://www.instagram.com/' : (url.includes('tiktok') ? 'https://www.tiktok.com/' : '')
      }
    });

    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    } else {
      res.setHeader('Content-Type', 'image/jpeg');
    }

    response.data.pipe(res);
  } catch (err) {
    console.error('Image proxy failed:', err.message);
    res.status(500).send('Görsel yüklenemedi.');
  }
});

// Serve index.html for all other paths
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`Server is running locally at: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
