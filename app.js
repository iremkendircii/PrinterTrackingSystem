const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

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

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Yazıcı ekleme endpoint'i
app.post("/add-printer", async (req, res) => {
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
    await fetchAndSavePrinterData(ip);
    updateIPsFile(ip, name);
    console.log(`Yazıcı başarıyla eklendi: ${ip} - ${name}`);
    res.json({ success: true, message: `Yazıcı (${ip} - ${name}) başarıyla eklendi!` });
  } catch (error) {
    console.error("Yazıcı ekleme hatası:", error);
    res.status(500).json({ error: error.message });
  }
});

// Yazıcı silme endpoint'i
app.delete("/delete-printer/:ip", (req, res) => {
  const ip = req.params.ip;

  try {
    // JSON dosyasını sil
    const jsonFile = path.join(
      __dirname,
      "json_outputs",
      `${ip.replace(/\./g, "_")}.json`
    );
    if (fs.existsSync(jsonFile)) {
      fs.unlinkSync(jsonFile);
    }

    // IP'yi ips.txt'den kaldır
    const ipsFile = "ips.txt";
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

// Yazıcı verilerini getirme endpoint'i
app.get("/printer-data", (req, res) => {
  try {
    const summary = generateSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CSV oluşturma endpoint'i
app.get("/summary.csv", (req, res) => {
  try {
    generateCSV();
    res.download(path.join(__dirname, "summary.csv"));
  } catch (error) {
    res.status(500).send(`Hata: ${error.message}`);
  }
});

// Fotokondüktör verilerini getirme endpoint'i
app.get("/photoconductor-data/:ip", (req, res) => {
  try {
    const ip = req.params.ip;
    const photoconductorData = getPhotoconductorData(ip);
    res.json(photoconductorData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Kit verilerini getirme endpoint'i
app.get("/kit-data/:ip", (req, res) => {
  try {
    const ip = req.params.ip;
    const kitData = getKitData(ip);
    res.json(kitData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function fetchAndSavePrinterData(ip) {
  const url = `http://${ip}/webglue/rawcontent?timedRefresh=1&c=Status&lang=tr`;
  const outputDir = "json_outputs";
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
  const ipsFile = "ips.txt";
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

function generateSummary() {
  const inputDir = path.join(__dirname, "json_outputs");
  const ipsFile = "ips.txt";
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
    };

    // JSON dosyası varsa verileri oku
    if (fs.existsSync(jsonFile)) {
      try {
        const stats = fs.statSync(jsonFile);
        const data = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
        const supplies = data?.nodes?.supplies || {};

        printerData.lastModified = stats.mtime;

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
      }
    }

    result.push(printerData);
  }

  return result;
}

function getUnitNameFromIP(ip) {
  const ipsFile = "ips.txt";
  if (!fs.existsSync(ipsFile)) return "Bilinmiyor";

  const lines = fs.readFileSync(ipsFile, "utf-8").split("\n").filter(Boolean);
  for (const line of lines) {
    if (line.trim().startsWith(ip)) {
      const parts = line.split(" - ");
      return parts.length > 1 ? parts[1].trim() : "Bilinmiyor";
    }
  }
  return "Bilinmiyor";
}

// CSV oluşturma fonksiyonu
function generateCSV() {
  const inputDir = path.join(__dirname, "json_outputs");
  const outputFile = path.join(__dirname, "summary.csv");
  let output = "IP,Son Güncelleme,Toner Adı,Yüzde Doluluk,Serial Number\n";
  let printerCount = 0;
  let tonerCount = 0;

  const files = fs.readdirSync(inputDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const ip = file.replace(".json", "").replace(/_/g, ".");
    const formattedDate = new Date(stats.mtime).toLocaleString("tr-TR");
    let hasPrinterData = false;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const supplies = data?.nodes?.supplies;

      if (supplies) {
        for (const key in supplies) {
          const item = supplies[key];
          const color = item?.color || item?.supplyName || key;
          const percent = item?.percentFull;

          if (color && percent !== undefined) {
            output += `${ip},${color},${percent},${
              item?.partNumber?.trim() || "Bilinmiyor"
            },${item?.pagesRemaining || "Bilinmiyor"},${
              item?.maxCapacityPages || "Bilinmiyor"
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
              output += `${ip},${key},${photoconductorPercent},${
                item?.serialNumber?.trim() || "Bilinmiyor"
              },${item?.pagesRemaining || "Bilinmiyor"},${
                item?.maxCapacityPages || "Bilinmiyor"
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
              output += `${ip},${key},${kitPercent},${
                item?.serialNumber?.trim() || "Bilinmiyor"
              },${item?.pagesRemaining || "Bilinmiyor"},${
                item?.maxCapacityPages || "Bilinmiyor"
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

// Otomatik veri güncelleme fonksiyonu
async function scheduleUpdate() {
  try {
    console.log("🔄 Otomatik veri güncelleme başlatılıyor...");
    await updateAllPrinters();
    
    // Kritik durumları kontrol et ve bildirim gönder
    const summary = generateSummary();
    const criticalItems = [];
    
    summary.forEach(printer => {
      if (printer.black && printer.black <= 1) criticalItems.push(`${printer.ip} - Siyah Toner: %${printer.black}`);
      if (printer.cyan && printer.cyan <= 1) criticalItems.push(`${printer.ip} - Mavi Toner: %${printer.cyan}`);
      if (printer.magenta && printer.magenta <= 1) criticalItems.push(`${printer.ip} - Kırmızı Toner: %${printer.magenta}`);
      if (printer.yellow && printer.yellow <= 1) criticalItems.push(`${printer.ip} - Sarı Toner: %${printer.yellow}`);
    });
    
    if (criticalItems.length > 0) {
      io.emit('criticalAlert', {
        message: 'Kritik toner seviyeleri tespit edildi!',
        items: criticalItems
      });
    }
    
    console.log("✅ Otomatik güncelleme tamamlandı");
  } catch (error) {
    console.error("❌ Otomatik güncelleme hatası:", error);
  }
}

// Her 5 dakikada bir otomatik güncelleme
setInterval(scheduleUpdate, 5 * 60 * 1000);

// Socket.io bağlantı yönetimi
io.on('connection', (socket) => {
  console.log('🔌 Yeni kullanıcı bağlandı:', socket.id);
  
  // Bağlantı anında kritik durumları gönder
  const summary = generateSummary();
  const criticalItems = [];
  
  summary.forEach(printer => {
    if (printer.black && printer.black <= 1) criticalItems.push(`${printer.ip} - Siyah Toner: %${printer.black}`);
    if (printer.cyan && printer.cyan <= 1) criticalItems.push(`${printer.ip} - Mavi Toner: %${printer.cyan}`);
    if (printer.magenta && printer.magenta <= 1) criticalItems.push(`${printer.ip} - Kırmızı Toner: %${printer.magenta}`);
    if (printer.yellow && printer.yellow <= 1) criticalItems.push(`${printer.ip} - Sarı Toner: %${printer.yellow}`);
  });
  
  if (criticalItems.length > 0) {
    socket.emit('criticalAlert', {
      message: 'Kritik toner seviyeleri tespit edildi!',
      items: criticalItems
    });
  }
  
  socket.on('disconnect', () => {
    console.log('🔌 Kullanıcı ayrıldı:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
  // Sunucu başladığında tüm yazıcıları güncelle
  scheduleUpdate();
});

// Tüm yazıcıları güncelleme fonksiyonu
async function updateAllPrinters() {
  try {
    const ipList = fs
      .readFileSync("ips.txt", "utf-8")
      .split("\n")
      .filter(Boolean);
    for (const ip of ipList) {
      const ipOnly = ip.split(" - ")[0].trim();
      await fetchAndSavePrinterData(ipOnly);
    }
    console.log("Tüm yazıcı verileri güncellendi");
  } catch (error) {
    console.error("Yazıcı güncelleme hatası:", error.message);
  }
}

// Fotokondüktör verilerini getir
function getPhotoconductorData(ip) {
  const jsonFile = path.join(
    __dirname,
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
  if (percent < 10) return "CRITICAL";
  if (percent < 30) return "LOW";
  return "NORMAL";
}
