const fs = require("fs");
const path = require("path");

const inputDir = path.join(__dirname, "json_outputs");
const outputFile = path.join(__dirname, "summary.csv");
const ipsFile = path.join(__dirname, "ips.txt"); // ips.txt dosya yolu

// IP-Birim eşleştirmelerini oku
const ipToBirim = {};
try {
  const ipsContent = fs.readFileSync(ipsFile, "utf-8");
  ipsContent.split("\n").forEach((line) => {
    if (line.trim() === "") return;
    const [ip, birim] = line.split(" - ").map((item) => item.trim());
    if (ip && birim) {
      ipToBirim[ip] = birim;
    }
  });
} catch (err) {
  console.warn(
    "⚠️ ips.txt dosyası okunamadı, birim bilgileri atlanacak:",
    err.message
  );
}

let output =
  "Birim,IP,Son Güncelleme Tarihi,Siyah Kartuş %,Mavi Kartuş %,Kırmızı Kartuş %,Sarı Kartuş %,Siyah Fotokondüktör %,Mavi Fotokondüktör %,Kırmızı Fotokondüktör %,Sarı Fotokondüktör %,Isıtıcı Kiti %,Bakım Kiti %,Seri Numarası\n";
let toplamYazici = 0;

const files = fs.readdirSync(inputDir).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const filePath = path.join(inputDir, file);
  const ip = file.replace(".json", "").replace(/_/g, ".");

  try {
    // Dosya istatistiklerini al
    const stats = fs.statSync(filePath);
    const lastModified = new Date(stats.mtime);

    // TR zaman diliminde formatla
    const formattedDate = lastModified
      .toLocaleString("tr-TR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "Europe/Istanbul",
      })
      .replace(/\s/g, " ")
      .replace(",", "");

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const supplies = data?.nodes?.supplies;
    if (!supplies) {
      console.warn(`⚠️  ${file}: supplies bilgisi bulunamadı.`);
      continue;
    }

    let printerData = {
      birim: ipToBirim[ip] || "BİRİM BULUNAMADI", // ips.txt'den birim bilgisini al
      ip: ip,
      lastModified: formattedDate, // Tarih bilgisini ekle
      black: "",
      cyan: "",
      magenta: "",
      yellow: "",
      blackPhotoconductor: "",
      cyanPhotoconductor: "",
      magentaPhotoconductor: "",
      yellowPhotoconductor: "",
      fuserKit: "",
      maintenanceKit: "",
      serial: "",
    };

    for (const key in supplies) {
      const item = supplies[key];
      const color = item?.color || item?.supplyName || key;
      const percent = item?.percentFull;
      const serialNumber = item?.serialNumber?.trim() || "Bilinmiyor";

      //emekten selamlar
      // Siyah kartuş için özel olarak "Black Toner" anahtarını ara
      if (supplies["Black Toner"]) {
        const blackObj = supplies["Black Toner"];
        printerData.black =
          blackObj.percentFull !== undefined
            ? blackObj.percentFull
            : blackObj.curlevel !== undefined
            ? blackObj.curlevel
            : "";
        printerData.serial = blackObj.serialNumber?.trim() || "Bilinmiyor";
      }

      if (color && percent !== undefined) {
        if (color.toLowerCase().includes("cyan")) {
          printerData.cyan = percent;
        } else if (color.toLowerCase().includes("magenta")) {
          printerData.magenta = percent;
        } else if (color.toLowerCase().includes("yellow")) {
          printerData.yellow = percent;
        }
      }

      // Fotokondüktör bilgilerini çıkar
      if (key === "Black Photoconductor") {
        printerData.blackPhotoconductor =
          item.percentFull !== undefined
            ? item.percentFull
            : item.curlevel !== undefined
            ? item.curlevel
            : "";
      } else if (key === "Cyan Photoconductor") {
        printerData.cyanPhotoconductor =
          item.percentFull !== undefined
            ? item.percentFull
            : item.curlevel !== undefined
            ? item.curlevel
            : "";
      } else if (key === "Magenta Photoconductor") {
        printerData.magentaPhotoconductor =
          item.percentFull !== undefined
            ? item.percentFull
            : item.curlevel !== undefined
            ? item.curlevel
            : "";
      } else if (key === "Yellow Photoconductor") {
        printerData.yellowPhotoconductor =
          item.percentFull !== undefined
            ? item.percentFull
            : item.curlevel !== undefined
            ? item.curlevel
            : "";
      }

      // Kit bilgilerini çıkar
      if (key === "Fuser Kit") {
        printerData.fuserKit =
          item.percentFull !== undefined
            ? item.percentFull
            : item.curlevel !== undefined
            ? item.curlevel
            : "";
      } else if (
        key === "Maintenance Kit" ||
        key === "200K HCF Maintenance Kit" ||
        key === "200K MPF Maintenance Kit" ||
        key === "300K Maintenance Kit"
      ) {
        printerData.maintenanceKit =
          item.percentFull !== undefined
            ? item.percentFull
            : item.curlevel !== undefined
            ? item.curlevel
            : "";
      }
    }

    //Birim belirleme kodu ipden çekilmiyor. ips.txt dosyasından çekiliyor bu kısımı sildim -Emek

    output += `${printerData.birim},${printerData.ip},${printerData.lastModified},${printerData.black},${printerData.cyan},${printerData.magenta},${printerData.yellow},${printerData.blackPhotoconductor},${printerData.cyanPhotoconductor},${printerData.magentaPhotoconductor},${printerData.yellowPhotoconductor},${printerData.fuserKit},${printerData.maintenanceKit},${printerData.serial}\n`;
    toplamYazici++;
  } catch (err) {
    console.warn(`❌ ${file} okunamadı: ${err.message}`);
  }
}

fs.writeFileSync(outputFile, output, "utf8");
console.log(`✔ summary.csv oluşturuldu!`);
console.log(`📊 Toplam yazıcı: ${toplamYazici}`);
