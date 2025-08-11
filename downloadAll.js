const fs = require('fs');
const axios = require('axios');
const path = require('path');

const ipList = fs.readFileSync('ips.txt', 'utf-8')
  .split('\n')
  .map(line => line.split('-')[0].trim())
  .filter(ip => ip && !ip.startsWith('usb'));
const baseUrl = 'http://{IP}/webglue/rawcontent?timedRefresh=1&c=Status&lang=tr';
const outputDir = 'json_outputs';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

async function fetchAndSave(ip) {
    const url = baseUrl.replace('{IP}', ip);
    const filename = path.join(outputDir, `${ip.replace(/\./g, '_')}.json`);

    try {
        const res = await axios.get(url, { timeout: 5000 });
        fs.writeFileSync(filename, JSON.stringify(res.data, null, 2), 'utf-8');
        console.log(`✔ Kaydedildi: ${filename}`);
    } catch (err) {
        console.error(`❌ ${ip} alınamadı: ${err.message}`);
    }
}

(async () => {
    for (const ip of ipList) {
        await fetchAndSave(ip.trim());
    }
})();
