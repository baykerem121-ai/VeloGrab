const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('instagram_embed.html', 'utf8');
const $ = cheerio.load(html);

console.log('--- Scanning script tags ---');
$('script').each((i, el) => {
  const content = $(el).html() || '';
  if (content.length > 100) {
    console.log(`Script [${i}] size: ${content.length}`);
    // Search for mp4 or jpg links inside
    const links = content.match(/https?:\/\/[^\s"'\\]+?\.(?:mp4|jpg|jpeg|png|webp)[^\s"'\\]*/gi);
    if (links) {
      console.log(`  Found ${links.length} media links! Sample:`);
      links.slice(0, 3).forEach((link, idx) => {
        console.log(`    [${idx}]`, link.substring(0, 100) + '...');
      });
    }
    
    // Look for JSON structures inside
    if (content.includes('shortcode_media') || content.includes('graphql') || content.includes('display_url')) {
      console.log(`  Contains matching keys (shortcode_media/graphql/display_url).`);
      // Let's dump some parts
      const idx = content.indexOf('display_url');
      if (idx !== -1) {
        console.log('  Snippet around display_url:', content.substring(idx - 100, idx + 300));
      }
    }
  }
});

console.log('\n--- Scanning iframe/img/video tags in HTML ---');
$('video').each((i, el) => {
  console.log('Video tag:', $(el).attr('src') || 'No src', $(el).html());
});
$('img').each((i, el) => {
  console.log('Img tag:', $(el).attr('src') || 'No src');
});
