const tobyg = require('@tobyg74/tiktok-api-dl');

async function testTobyG() {
  console.log('--- Testing @tobyg74/tiktok-api-dl exports ---');
  console.log('Exported keys:', Object.keys(tobyg));
  
  const url = 'https://www.tiktok.com/@mrbeast/video/7342939634937220395';
  
  const func = tobyg.TiktokDL || tobyg.tiktokdl || tobyg.default || tobyg;
  console.log('Selected function type:', typeof func);
  
  if (typeof func === 'function') {
    try {
      const result = await func(url);
      console.log('Success:', JSON.stringify(result, null, 2).substring(0, 1500) + '...');
    } catch (err) {
      console.error('Error executing selected function:', err.message || err);
    }
  } else if (typeof func === 'object') {
    console.log('Func keys:', Object.keys(func));
    // Check inside keys
    for (const key of Object.keys(func)) {
      if (typeof func[key] === 'function') {
        try {
          console.log(`Calling func.${key}...`);
          const result = await func[key](url);
          console.log(`func.${key} Success:`, JSON.stringify(result, null, 2).substring(0, 800) + '...');
        } catch (err) {
          console.error(`func.${key} Error:`, err.message || err);
        }
      }
    }
  }
}

testTobyG();













