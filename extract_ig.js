const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('instagram_embed.html', 'utf8');
const $ = cheerio.load(html);

$('script').each((i, el) => {
  const scriptContent = $(el).html() || '';
  if (scriptContent.includes('display_url') || scriptContent.includes('video_url')) {
    console.log(`\nScript #${i} contains target keywords. Length: ${scriptContent.length}`);
    
    // Check if the script content has JSON or variables
    // Often it contains: {"display_url": "..."}
    // Let's search using a regex for unescaped or escaped strings
    const displayUrls = [];
    const videoUrls = [];
    
    // Try to find display_url pattern
    const displayRegex = /"display_url"\s*:\s*"([^"]+)"/g;
    let match;
    while ((match = displayRegex.exec(scriptContent)) !== null) {
      displayUrls.push(match[1].replace(/\\/g, ''));
    }
    
    // Try to find video_url pattern
    const videoRegex = /"video_url"\s*:\s*"([^"]+)"/g;
    while ((match = videoRegex.exec(scriptContent)) !== null) {
      videoUrls.push(match[1].replace(/\\/g, ''));
    }
    
    console.log(`Found ${displayUrls.length} display URLs:`);
    displayUrls.slice(0, 5).forEach((u, idx) => console.log(`  [Display ${idx}]`, u.substring(0, 150)));
    
    console.log(`Found ${videoUrls.length} video URLs:`);
    videoUrls.slice(0, 5).forEach((u, idx) => console.log(`  [Video ${idx}]`, u.substring(0, 150)));
  }
});

