const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function downloadYtDlp() {
  const platform = process.platform;
  let binaryName = 'yt-dlp';
  let url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';

  // SORUN 2 DÜZELTME: Platforma göre dinamik binary ve indirme URL'si seçimi
  if (platform === 'win32') {
    binaryName = 'yt-dlp.exe';
    url += 'yt-dlp.exe';
  } else if (platform === 'darwin') {
    binaryName = 'yt-dlp';
    url += 'yt-dlp_macos';
  } else {
    // Linux ve diğerleri
    binaryName = 'yt-dlp';
    url += 'yt-dlp';
  }

  const outputPath = path.join(__dirname, binaryName);
  
  console.log(`Downloading ${binaryName} from: ${url}`);
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`${binaryName} downloaded successfully to: ${outputPath}`);
        
        // SORUN 2 DÜZELTME: Linux ve macOS'ta dosya çalıştırma izinlerini (chmod 755) ayarlama
        if (platform !== 'win32') {
          try {
            fs.chmodSync(outputPath, '755');
            console.log(`Permissions set to 755 for: ${outputPath}`);
          } catch (chmodErr) {
            console.warn('Warning: Could not set executable permissions via chmodSync:', chmodErr.message);
          }
        }
        resolve();
      });
      writer.on('error', (err) => {
        console.error('Writer error:', err);
        reject(err);
      });
    });
  } catch (err) {
    console.error('Download failed:', err.message);
  }
}

downloadYtDlp();
