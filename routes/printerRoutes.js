const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// TR zaman dilimi formatı için yardımcı fonksiyon
function formatTurkishDateTime(date) {
  return date
    .toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(".", "/")
    .replace(".", "/")
    .replace(",", "");
}

// Yazıcı verilerini getirme endpoint'i
router.get('/printer-data', (req, res) => {
  try {
    const summary = generateSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Yenileme endpoint'i - downloadAll.js ve generateSummary.js çalıştırır
router.post('/refresh-data', async (req, res) => {
  try {
    console.log("🔄 Manuel yenileme başlatılıyor...");
    
    // downloadAll.js çalıştır
    await runDownloadAll();
    
    // generateSummary.js çalıştır
    await runGenerateSummary();
    
    // Socket.io ile frontend'e bildirim gönder
    req.app.get('io').emit('dataRefreshed', {
      timestamp: formatTurkishDateTime(new Date()),
      message: 'Veriler başarıyla yenilendi'
    });
    
    console.log("✅ Manuel yenileme tamamlandı");
    res.json({ success: true, message: "Veriler başarıyla yenilendi" });
  } catch (error) {
    console.error("❌ Manuel yenileme hatası:", error);
    res.status(500).json({ error: error.message });
  }
});

// Yazıcı ekleme endpoint'i
router.post('/add-printer', async (req, res) => {
  const ip = req.body.ip.trim();
  const name = req.body.name.trim();

  if (!ip) {
    return res.status(400).json({ error: "IP adresi gerekli" });
  }

  if (!name) {
    return res.status(400).json({ error: "Yazıcı adı gerekli" });
  }

  // IP formatını kontrol et
  if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
    return res.status(400).json({ error: "Geçersiz IP adresi formatı" });
  }

  try {
    // IP zaten var mı kontrol et
    const ipsFile = "ips.txt";
    if (fs.existsSync(ipsFile)) {
      const existingIPs = fs.readFileSync(ipsFile, "utf-8").split("\n").filter(Boolean);
      const ipExists = existingIPs.some((line) => line.trim().startsWith(ip));
      if (ipExists) {
        return res.status(400).json({ error: "Bu IP adresi zaten kayıtlı!" });
      }
    }

    console.log(`Yazıcı ekleniyor: ${ip} - ${name}`);
    
    // IP'yi ips.txt'ye ekle
    updateIPsFile(ip, name);
    
    // Yeni yazıcı için veri çek
    await fetchAndSavePrinterData(ip);
    
    // generateSummary.js çalıştır
    await runGenerateSummary();
    
    // Socket.io ile frontend'e bildirim gönder
    req.app.get('io').emit('printerAdded', {
      ip: ip,
      name: name,
      timestamp: formatTurkishDateTime(new Date()),
      message: `Yazıcı (${ip} - ${name}) başarıyla eklendi!`
    });
    
    console.log(`Yazıcı başarıyla eklendi: ${ip} - ${name}`);
    res.json({ success: true, message: `Yazıcı (${ip} - ${name}) başarıyla eklendi!` });
  } catch (error) {
    console.error("Yazıcı ekleme hatası:", error);
    res.status(500).json({ error: error.message });
  }
});

// Yazıcı silme endpoint'i
router.delete('/delete-printer/:ip', (req, res) => {
  const ip = req.params.ip;

  try {
    // JSON dosyasını sil
    const jsonFile = path.join(
      __dirname,
      "..",
      "json_outputs",
      `${ip.replace(/\./g, "_")}.json`
    );
    if (fs.existsSync(jsonFile)) {
      fs.unlinkSync(jsonFile);
    }

    // IP'yi ips.txt'den kaldır
    const ipsFile = path.join(__dirname, "..", "ips.txt");
    if (fs.existsSync(ipsFile)) {
      let ips = fs.readFileSync(ipsFile, "utf-8").split("\n").filter(Boolean);
      ips = ips.filter((line) => !line.trim().startsWith(ip + " -"));
      fs.writeFileSync(ipsFile, ips.join("\n"), "utf-8");
    }

    res.send(`Yazıcı (${ip}) başarıyla silindi!`);
  } catch (error) {
    res.status(500).send(`Hata: ${error.message}`);
  }
});

// CSV oluşturma endpoint'i
router.get('/summary.csv', (req, res) => {
  try {
    generateCSV();
    res.download(path.join(__dirname, "..", "summary.csv"));
  } catch (error) {
    res.status(500).send(`Hata: ${error.message}`);
  }
});

// Fotokondüktör verilerini getirme endpoint'i
router.get('/photoconductor-data/:ip', (req, res) => {
  try {
    const ip = req.params.ip;
    const photoconductorData = getPhotoconductorData(ip);
    res.json(photoconductorData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Kit verilerini getirme endpoint'i
router.get('/kit-data/:ip', (req, res) => {
  try {
    const ip = req.params.ip;
    const kitData = getKitData(ip);
    res.json(kitData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Yardımcı fonksiyonlar
async function fetchAndSavePrinterData(ip) {
  const url = `http://${ip}/webglue/rawcontent?timedRefresh=1&c=Status&lang=tr`;
  const outputDir = path.join(__dirname, "..", "json_outputs");
  const filename = path.join(outputDir, `${ip.replace(/\./g, "_")}.json`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  try {
    const response = await axios.get(url, {
      timeout: 15000, // 15 saniye timeout
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // Mevcut dosya varsa tarihini koruyarak güncelle
    let mtime = new Date();
    if (fs.existsSync(filename)) {
      const stats = fs.statSync(filename);
      mtime = stats.mtime;
    }

    fs.writeFileSync(filename, JSON.stringify(response.data, null, 2), "utf-8");

    // Dosyanın değiştirilme tarihini güncelle
    fs.utimesSync(filename, mtime, mtime);
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      throw new Error(
        `Yazıcıya erişim zaman aşımına uğradı (${ip}). Yazıcının açık olduğundan ve ağa bağlı olduğundan emin olun.`
      );
    } else if (error.code === "ENOTFOUND") {
      throw new Error(
        `Yazıcı bulunamadı (${ip}). IP adresinin doğru olduğundan emin olun.`
      );
    } else if (error.code === "ECONNREFUSED") {
      throw new Error(
        `Yazıcı bağlantısı reddedildi (${ip}). Yazıcının web arayüzünün açık olduğundan emin olun.`
      );
    } else {
      throw new Error(`Yazıcıya erişim hatası (${ip}): ${error.message}`);
    }
  }
}

function updateIPsFile(ip, name) {
  const ipsFile = path.join(__dirname, "..", "ips.txt");
  let ips = [];

  if (fs.existsSync(ipsFile)) {
    const existingIPs = fs
      .readFileSync(ipsFile, "utf-8")
      .split("\n")
      .filter(Boolean);
    ips = existingIPs;
  }

  // IP zaten varsa ekleme
  const ipExists = ips.some((line) => line.trim().startsWith(ip));
  if (!ipExists) {
    ips.push(`${ip} - ${name}`);
    fs.writeFileSync(ipsFile, ips.join("\n"), "utf-8");
  }
}

// downloadAll.js çalıştırma fonksiyonu
function runDownloadAll() {
  return new Promise((resolve, reject) => {
    try {
      const downloadAll = require('../utils/downloadAll.js');
      downloadAll.run()
        .then(() => {
          console.log('downloadAll.js başarıyla çalıştırıldı');
          resolve();
        })
        .catch((error) => {
          console.error('downloadAll.js çalıştırma hatası:', error);
          reject(error);
        });
    } catch (error) {
      console.error('downloadAll.js modül yükleme hatası:', error);
      reject(error);
    }
  });
}

// generateSummary.js çalıştırma fonksiyonu
function runGenerateSummary() {
  return new Promise((resolve, reject) => {
    try {
      const generateSummary = require('../utils/generateSummary.js');
      generateSummary.generateSummary();
      console.log('generateSummary.js başarıyla çalıştırıldı');
      resolve();
    } catch (error) {
      console.error('generateSummary.js çalıştırma hatası:', error);
      reject(error);
    }
  });
}

function generateSummary() {
  const inputDir = path.join(__dirname, "..", "json_outputs");
  const ipsFile = path.join(__dirname, "..", "ips.txt");
  const result = [];

  // ips.txt'den tüm IP'leri oku
  let allIPs = [];
  if (fs.existsSync(ipsFile)) {
    const lines = fs.readFileSync(ipsFile, "utf-8").split("\n").filter(Boolean);
    allIPs = lines.map(line => {
      const parts = line.split(" - ");
      return {
        ip: parts[0].trim(),
        unit: parts.length > 1 ? parts[1].trim() : "Bilinmiyor"
      };
    });
  }

  // Her IP için veri oluştur
  for (const printerInfo of allIPs) {
    const ip = printerInfo.ip;
    const jsonFile = path.join(inputDir, `${ip.replace(/\./g, "_")}.json`);
    
    const printerData = {
      ip,
      lastModified: null,
      unit: printerInfo.unit,
      black: null,
      cyan: null,
      magenta: null,
      yellow: null,
      serialNo: "Bilinmiyor",
      status: "offline" // Varsayılan olarak offline
    };

    // JSON dosyası varsa verileri oku
    if (fs.existsSync(jsonFile)) {
      try {
        const stats = fs.statSync(jsonFile);
        const data = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
        const supplies = data?.nodes?.supplies || {};

        printerData.lastModified = stats.mtime;

        // Offline kontrolü - 30 dakika (30 * 60 * 1000 ms)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        if (stats.mtime > thirtyMinutesAgo) {
          printerData.status = "online";
        } else {
          printerData.status = "offline";
        }

        // Sadece Black Toner anahtarını kullan
        if (supplies["Black Toner"]) {
          const blackObj = supplies["Black Toner"];
          printerData.black =
            blackObj.percentFull !== undefined
              ? blackObj.percentFull
              : blackObj.curlevel !== undefined
              ? blackObj.curlevel
              : null;
          if (blackObj.serialNumber)
            printerData.serialNo = blackObj.serialNumber.trim();
        }

        for (const key in supplies) {
          const item = supplies[key];
          const color = item?.color?.toLowerCase();

          // Diğer renkler için
          if (color && item?.percentFull !== undefined) {
            if (color === "cyan") printerData.cyan = item.percentFull;
            else if (color === "magenta") printerData.magenta = item.percentFull;
            else if (color === "yellow") printerData.yellow = item.percentFull;
          }
          // Seri numarası yedeği
          if (printerData.serialNo === "Bilinmiyor" && item?.partNumber) {
            printerData.serialNo = item.partNumber.trim();
          }
        }
      } catch (err) {
        console.warn(`❌ ${ip} JSON dosyası işlenirken hata: ${err.message}`);
        printerData.status = "offline";
      }
    } else {
      // JSON dosyası yoksa offline
      printerData.status = "offline";
    }

    result.push(printerData);
  }

  return result;
}

// CSV oluşturma fonksiyonu
function generateCSV() {
  const inputDir = path.join(__dirname, "..", "json_outputs");
  const outputFile = path.join(__dirname, "..", "summary.csv");
  let output = "IP,Son Güncelleme,Toner Adı,Yüzde Doluluk,Serial Number\n";
  let printerCount = 0;
  let tonerCount = 0;

  const files = fs.readdirSync(inputDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const ip = file.replace(".json", "").replace(/_/g, ".");
    let hasPrinterData = false;

    try {
      const stats = fs.statSync(filePath);
      const formattedDate = new Date(stats.mtime).toLocaleString("tr-TR");
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const supplies = data?.nodes?.supplies;

      if (supplies) {
        for (const key in supplies) {
          const item = supplies[key];
          const color = item?.color || item?.supplyName || key;
          const percent = item?.percentFull;

          if (color && percent !== undefined) {
            output += `${ip},${formattedDate},${color},${percent},${
              item?.partNumber?.trim() || "Bilinmiyor"
            }\n`;
            tonerCount++;
            hasPrinterData = true;
          }

          // Fotokondüktör bilgilerini CSV'ye ekle
          if (key.includes("Photoconductor")) {
            const photoconductorPercent =
              item?.percentFull !== undefined
                ? item.percentFull
                : item?.curlevel !== undefined
                ? item?.curlevel
                : null;

            if (photoconductorPercent !== null) {
              output += `${ip},${formattedDate},${key},${photoconductorPercent},${
                item?.serialNumber?.trim() || "Bilinmiyor"
              }\n`;
              tonerCount++;
              hasPrinterData = true;
            }
          }

          // Kit bilgilerini CSV'ye ekle
          if (key.includes("Kit")) {
            const kitPercent =
              item?.percentFull !== undefined
                ? item.percentFull
                : item?.curlevel !== undefined
                ? item?.curlevel
                : null;

            if (kitPercent !== null) {
              output += `${ip},${formattedDate},${key},${kitPercent},${
                item?.serialNumber?.trim() || "Bilinmiyor"
              }\n`;
              tonerCount++;
              hasPrinterData = true;
            }
          }
        }
      }

      if (hasPrinterData) printerCount++;
    } catch (err) {
      console.warn(`❌ ${file} işlenirken hata: ${err.message}`);
    }
  }

  fs.writeFileSync(outputFile, output, "utf8");
  console.log(`✔ summary.csv oluşturuldu!`);
  console.log(`📊 Toplam yazıcı: ${printerCount}, Toplam toner: ${tonerCount}`);
}

// Fotokondüktör verilerini getir
function getPhotoconductorData(ip) {
  const jsonFile = path.join(
    __dirname,
    "..",
    "json_outputs",
    `${ip.replace(/\./g, "_")}.json`
  );

  if (!fs.existsSync(jsonFile)) {
    return { error: "Yazıcı verisi bulunamadı" };
  }

  try {
    const data = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
    const supplies = data?.nodes?.supplies;
    const photoconductors = {};

    if (supplies) {
      for (const key in supplies) {
        if (key.includes("Photoconductor")) {
          const item = supplies[key];
          const percent =
            item?.percentFull !== undefined
              ? item.percentFull
              : item?.curlevel !== undefined
              ? item?.curlevel
              : null;

          if (percent !== null) {
            const color = key.replace(" Photoconductor", "").toLowerCase();
            photoconductors[color] = { percentFull: percent };
          }
        }
      }
    }

    return photoconductors;
  } catch (error) {
    return { error: error.message };
  }
}

// Kit verilerini getir
function getKitData(ip) {
  const jsonFile = path.join(
    __dirname,
    "..",
    "json_outputs",
    `${ip.replace(/\./g, "_")}.json`
  );

  if (!fs.existsSync(jsonFile)) {
    return { error: "Yazıcı verisi bulunamadı" };
  }

  try {
    const data = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
    const supplies = data?.nodes?.supplies;
    const kits = {};

    if (supplies) {
      for (const key in supplies) {
        // Bakım kitleri
        if (key.includes("Kit")) {
          const item = supplies[key];
          const percent =
            item?.percentFull !== undefined
              ? item.percentFull
              : item?.curlevel !== undefined
              ? item?.curlevel
              : null;

          if (percent !== null) {
            kits[key] = { 
              percent: percent, 
              status: getStatusLabel(percent),
              type: "kit"
            };
          }
        }
        
        // Siyah Developer
        if (key === "Black Developer") {
          const item = supplies[key];
          const percent =
            item?.percentFull !== undefined
              ? item.percentFull
              : item?.curlevel !== undefined
              ? item?.curlevel
              : null;

          if (percent !== null) {
            kits["Siyah Developer"] = { 
              percent: percent, 
              status: getStatusLabel(percent),
              type: "developer",
              serialNumber: item?.serialNumber || "Bilinmiyor"
            };
          }
        }
        
        // Arık Toner Şişesi
        if (key === "Toner Bottle") {
          const item = supplies[key];
          const percent =
            item?.percentFull !== undefined
              ? item.percentFull
              : item?.curlevel !== undefined
              ? item?.curlevel
              : null;

          if (percent !== null) {
            kits["Arık Toner Şişesi"] = { 
              percent: percent, 
              status: getStatusLabel(percent),
              type: "waste",
              serialNumber: item?.serialNumber || "Bilinmiyor"
            };
          }
        }
      }
    }

    return kits;
  } catch (error) {
    return { error: error.message };
  }
}

function getStatusLabel(percent) {
  if (percent < 2) return "CRITICAL";
  if (percent < 30) return "LOW";
  return "NORMAL";
}

module.exports = router;

