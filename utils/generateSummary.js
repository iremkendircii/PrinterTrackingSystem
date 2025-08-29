const fs = require('fs');
const path = require('path');

function generateSummary() {
  const inputDir = path.join(__dirname, '..', 'json_outputs');
  const ipsFile = path.join(__dirname, '..', 'ips.txt');
  const result = [];

  // ips.txt'den tüm IP'leri oku
  let allIPs = [];
  if (fs.existsSync(ipsFile)) {
    const lines = fs.readFileSync(ipsFile, 'utf-8').split('\n').filter(Boolean);
    allIPs = lines.map(line => {
      const parts = line.split(' - ');
      return {
        ip: parts[0].trim(),
        unit: parts.length > 1 ? parts[1].trim() : 'Bilinmiyor'
      };
    });
  }

  // Her IP için veri oluştur
  for (const printerInfo of allIPs) {
    const ip = printerInfo.ip;
    const jsonFile = path.join(inputDir, `${ip.replace(/\./g, '_')}.json`);
    
    const printerData = {
      ip,
      lastModified: null,
      unit: printerInfo.unit,
      black: null,
      cyan: null,
      magenta: null,
      yellow: null,
      serialNo: 'Bilinmiyor',
    };

    // JSON dosyası varsa verileri oku
    if (fs.existsSync(jsonFile)) {
      try {
        const stats = fs.statSync(jsonFile);
        const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        const supplies = data?.nodes?.supplies || {};

        printerData.lastModified = stats.mtime;

        // Sadece Black Toner anahtarını kullan
        if (supplies['Black Toner']) {
          const blackObj = supplies['Black Toner'];
          printerData.black = blackObj.percentFull !== undefined ? blackObj.percentFull : blackObj.curlevel !== undefined ? blackObj.curlevel : null;
          if (blackObj.serialNumber) printerData.serialNo = blackObj.serialNumber.trim();
        }

        for (const key in supplies) {
          const item = supplies[key];
          const color = item?.color?.toLowerCase();

          // Diğer renkler için
          if (color && item?.percentFull !== undefined) {
            if (color === 'cyan') printerData.cyan = item.percentFull;
            else if (color === 'magenta') printerData.magenta = item.percentFull;
            else if (color === 'yellow') printerData.yellow = item.percentFull;
          }
          // Seri numarası yedeği
          if (printerData.serialNo === 'Bilinmiyor' && item?.partNumber) {
            printerData.serialNo = item.partNumber.trim();
          }
        }
      } catch (err) {
        console.warn(`❌ ${ip} JSON dosyası işlenirken hata: ${err.message}`);
      }
    }

    result.push(printerData);
  }

  return result;
}

// Sadece bir kez çalıştır (backend'den çağrılacak)
if (require.main === module) {
  generateSummary();
}

module.exports = { generateSummary };
