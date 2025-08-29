const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");

// Route'ları import et
const printerRoutes = require('./routes/printerRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Socket.io instance'ını app'e ekle (route'larda kullanmak için)
app.set('io', io);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static dosyalar için express.static kullan
app.use(express.static(path.join(__dirname, 'public')));

// API route'larını /api prefix'i ile kullan
app.use('/api', printerRoutes);

// Ana sayfa route'u
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login sayfası route'u
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// CSV dosyası indirme route'u
app.get('/summary.csv', (req, res) => {
  const csvPath = path.join(__dirname, 'summary.csv');
  if (fs.existsSync(csvPath)) {
    res.download(csvPath);
  } else {
    res.status(404).send('CSV dosyası bulunamadı');
  }
});

// Socket.io bağlantı yönetimi
io.on("connection", (socket) => {
  console.log("🔌 Yeni kullanıcı bağlandı:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔌 Kullanıcı ayrıldı:", socket.id);
  });
});

// Otomatik yenileme fonksiyonu
async function scheduleUpdate() {
  try {
    console.log("🔄 Otomatik yenileme başlatılıyor...");
    
    // downloadAll.js çalıştır
    const downloadAll = require('./utils/downloadAll.js');
    await downloadAll.run();
    
    // generateSummary.js çalıştır
    const generateSummary = require('./utils/generateSummary.js');
    generateSummary.generateSummary();
    
    // Socket.io ile frontend'e bildirim gönder
    io.emit('autoRefresh', {
      timestamp: new Date().toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).replace(".", "/").replace(".", "/").replace(",", ""),
      message: 'Otomatik yenileme tamamlandı'
    });
    
    console.log("✅ Otomatik yenileme tamamlandı");
  } catch (error) {
    console.error("❌ Otomatik yenileme hatası:", error);
  }
}

// Kritik toner kontrolü ve bildirim gönderme
function checkCriticalToner() {
  try {
    const summary = require('./utils/generateSummary.js').generateSummary();
    const criticalItems = [];

    summary.forEach((printer) => {
      if (printer.black && printer.black < 2) {
        criticalItems.push(`${printer.ip} - Siyah Toner: %${printer.black}`);
      }
      if (printer.cyan && printer.cyan < 2) {
        criticalItems.push(`${printer.ip} - Mavi Toner: %${printer.cyan}`);
      }
      if (printer.magenta && printer.magenta < 2) {
        criticalItems.push(`${printer.ip} - Kırmızı Toner: %${printer.magenta}`);
      }
      if (printer.yellow && printer.yellow < 2) {
        criticalItems.push(`${printer.ip} - Sarı Toner: %${printer.yellow}`);
      }
    });

    if (criticalItems.length > 0) {
      io.emit("criticalAlert", {
        message: "Kritik toner seviyesi tespit edildi!",
        items: criticalItems,
      });
      console.log("🚨 Kritik toner uyarısı gönderildi:", criticalItems);
    }
  } catch (error) {
    console.error("❌ Kritik toner kontrolü hatası:", error);
  }
}

// İlk çalıştırma
console.log("🚀 Yazıcı Takip Sistemi başlatılıyor...");

// İlk veri çekme işlemi
scheduleUpdate();

// 5 dakikada bir otomatik yenileme
setInterval(scheduleUpdate, 5 * 60 * 1000);

// 2 dakikada bir kritik toner kontrolü
setInterval(checkCriticalToner, 2 * 60 * 1000);

// Server'ı başlat
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server ${PORT} portunda çalışıyor`);
  console.log(`🌐 http://localhost:${PORT} adresinden erişebilirsiniz`);
  console.log(`📊 Otomatik yenileme: 5 dakikada bir`);
  console.log(`🚨 Kritik toner kontrolü: 2 dakikada bir`);
});


