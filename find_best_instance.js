const fs = require('fs');
const path = require('path');

const filePath = 'C:/Users/BTG/.gemini/antigravity/brain/0588155e-2419-454c-b1fb-9be86043318e/.system_generated/steps/152/content.md';

try {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // SvelteKit data is usually inside a script block. Let's search for the JSON data.
  // The line matches: data:{official:[...],community:[...]}
  const match = content.match(/data:\{official:\[([\s\S]*?)\],community:\[([\s\S]*?)\]\}/);
  
  if (!match) {
    console.log('SvelteKit data block not found in HTML!');
    // Let's try searching for "community:["
    const commMatch = content.match(/community:\[([\s\S]*?)\]/);
    if (commMatch) {
      console.log('Found community match, trying to parse...');
      const dataStr = '[' + commMatch[1] + ']';
      // SvelteKit serializes JS objects, which aren't strict JSON (e.g. keys are unquoted, status:true).
      // We can use eval to parse it safely since it's a static file we just retrieved.
      const community = eval(dataStr);
      console.log(`Found ${community.length} community instances.`);
      
      const results = community.map(inst => ({
        api: inst.api,
        totals: inst.totals,
        score: inst.scorePct,
        tiktok: inst.tests.tiktok ? inst.tests.tiktok.status : false,
        instagram: inst.tests.instagram ? inst.tests.instagram.status : false,
        youtube: inst.tests.youtube ? inst.tests.youtube.status : false
      }));
      
      console.log('\n--- ALL INSTANCES & STATUS ---');
      console.table(results);
      
      console.log('\n--- WORKING INSTANCES FOR TIKTOK & INSTAGRAM ---');
      const working = results.filter(r => r.tiktok && r.instagram);
      console.table(working);
    } else {
      console.log('No matches found at all.');
    }
  } else {
    const dataStr = '{official:[' + match[1] + '],community:[' + match[2] + ']}';
    const parsed = eval('(' + dataStr + ')');
    console.log(`Official hosts: ${parsed.official.length}, Community hosts: ${parsed.community.length}`);
    
    const results = parsed.community.map(inst => ({
      api: inst.api,
      score: inst.scorePct,
      tiktok: inst.tests.tiktok ? inst.tests.tiktok.status : false,
      instagram: inst.tests.instagram ? inst.tests.instagram.status : false,
      youtube: inst.tests.youtube ? inst.tests.youtube.status : false
    }));
    
    console.table(results);
  }
} catch (err) {
  console.error('Error:', err.message);
}
