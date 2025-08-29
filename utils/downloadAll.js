const fs = require('fs');
const axios = require('axios');
const path = require('path');

async function run() {
  const ipList = fs.readFileSync(path.join(__dirname, '..', 'ips.txt'), 'utf-8')
    .split('\n')
    .map(line => line.split('-')[0].trim())
    .filter(ip => ip && !ip.startsWith('usb'));

  const baseUrl = 'http://{IP}/webglue/rawcontent?timedRefresh=1&c=Status&lang=tr';
  const outputDir = path.join(__dirname, '..', 'json_outputs');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  console.log(`\n ... ${new Date().toLocaleString()} - Veri çekme başladı...\n `);
  
  for (const ip of ipList) {
    await fetchAndSave(ip.trim());
  }
  
  console.log(` ...Veri çekme tamamlandı ...\n`);
}

async function fetchAndSave(ip) {
  const url = `http://${ip}/webglue/rawcontent?timedRefresh=1&c=Status&lang=tr`;
  const filename = path.join(__dirname, '..', 'json_outputs', `${ip.replace(/\./g, '_')}.json`);

  try {
    const res = await axios.get(url, { timeout: 1000 });
    fs.writeFileSync(filename, JSON.stringify(res.data, null, 2), 'utf-8');
    console.log(`[${new Date().toLocaleTimeString()}] ✔ Kaydedildi: ${filename}`);
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] ❌ ${ip} alınamadı: ${err.message}`);
  }
}

// Sadece bir kez çalıştır (backend'den çağrılacak)
if (require.main === module) {
  run();
}

module.exports = { run };
