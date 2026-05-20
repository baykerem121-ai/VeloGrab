const { execFile } = require('child_process');
const path = require('path');

function getInfo(url) {
  return new Promise((resolve, reject) => {
    const ytDlpPath = path.join(__dirname, 'yt-dlp.exe');
    execFile(ytDlpPath, ['--dump-json', '--no-warnings', url], (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function run() {
  console.log('--- Testing yt-dlp for Instagram ---');
  try {
    const info = await getInfo('https://www.instagram.com/p/ByxKbUSnubS/');
    console.log('Instagram title:', info.title);
    console.log('Instagram extractor:', info.extractor_key);
    console.log('Instagram direct URL:', info.url ? info.url.substring(0, 100) + '...' : 'None');
  } catch (err) {
    console.error('Instagram Error:', err.message || err);
  }
}

run();

