// Global değişkenler
let currentSort = {
  column: null,
  direction: "asc", // 'asc' veya 'desc'
};

// Bildirim durumu
let notificationsEnabled = localStorage.getItem("notificationsEnabled") !== "false";

// Socket.io bağlantısı
const socket = io();

// Socket.io event listeners
socket.on("criticalAlert", (data) => {
  if (notificationsEnabled) {
    showCriticalNotification(data.message, data.items);
  }
});

// Manuel yenileme tamamlandığında
socket.on("dataRefreshed", (data) => {
  console.log("Manuel yenileme tamamlandı:", data);
  fetchPrinterData();
  updateLastRefreshTime(data.timestamp);
  showToast(data.message, "success");
});

// Otomatik yenileme tamamlandığında
socket.on("autoRefresh", (data) => {
  console.log("Otomatik yenileme tamamlandı:", data);
  fetchPrinterData();
  updateLastRefreshTime(data.timestamp);
});

// Yeni yazıcı eklendiğinde
socket.on("printerAdded", (data) => {
  console.log("Yeni yazıcı eklendi:", data);
  fetchPrinterData();
  showToast(data.message, "success");
});

// Sayfa yüklendiğinde çalışacak fonksiyonlar
document.addEventListener("DOMContentLoaded", async function () {
  // Kimlik doğrulama kontrolü
  if (sessionStorage.getItem("authenticated") !== "true") {
    window.location.href = "login.html";
    return;
  }

  // Bildirim izni iste
  requestNotificationPermission();

  // Bildirim buton durumunu ayarla
  updateNotificationButton();

  // Verileri yükle
  await fetchPrinterData();

  // Modal event listeners
  document.querySelector(".close").addEventListener("click", function () {
    document.getElementById("detailsModal").style.display = "none";
  });

  window.addEventListener("click", function (event) {
    if (event.target === document.getElementById("detailsModal")) {
      document.getElementById("detailsModal").style.display = "none";
    }
  });

  // Form event listeners
  document.getElementById("printerIp").addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      document.getElementById("printerName").focus();
    }
  });

  document.getElementById("printerName").addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      addPrinter();
    }
  });
});

// Bildirimleri aç/kapat
function toggleNotifications() {
  notificationsEnabled = !notificationsEnabled;
  localStorage.setItem("notificationsEnabled", notificationsEnabled);

  const btn = document.getElementById("notificationBtn");
  if (notificationsEnabled) {
    btn.innerHTML = '<i class="fas fa-bell"></i> Bildirimler';
    btn.classList.remove("btn-notifications-off");
    showToast("Bildirimler açıldı", "success");
  } else {
    btn.innerHTML = '<i class="fas fa-bell-slash"></i> Bildirimler';
    btn.classList.add("btn-notifications-off");
    showToast("Bildirimler kapatıldı", "info");
  }
}

// Sayfa yüklendiğinde buton durumunu ayarla
function updateNotificationButton() {
  const btn = document.getElementById("notificationBtn");
  if (notificationsEnabled) {
    btn.innerHTML = '<i class="fas fa-bell"></i> Bildirimler';
    btn.classList.remove("btn-notifications-off");
  } else {
    btn.innerHTML = '<i class="fas fa-bell-slash"></i> Bildirimler';
    btn.classList.add("btn-notifications-off");
  }
}

// Kritik uyarı bildirimi göster
function showCriticalNotification(message, items) {
  // Tarayıcı bildirimi
  if (Notification.permission === "granted") {
    const notification = new Notification("Yazıcı Uyarısı", {
      body: `${message}\n${items.join("\n")}`,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
    });

    notification.onclick = function () {
      window.focus();
      notification.close();
    };
  }

  // Toast bildirimi
  showToast(`${message}\n${items.join("\n")}`, "error");

  // Ses uyarısı
  playAlertSound();
}

// Ses uyarısı çal
function playAlertSound() {
  const audio = new Audio(
    "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
  );
  audio.play().catch((e) => console.log("Ses çalınamadı:", e));
}

// Bildirim izni iste
function requestNotificationPermission() {
  if (Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        console.log("Bildirim izni verildi");
      }
    });
  }
}

// Veri çekme fonksiyonu
async function fetchPrinterData() {
  try {
    const response = await fetch("/api/printer-data");
    const data = await response.json();

    if (Array.isArray(data)) {
      // Global değişkende sakla
      window.currentPrinterData = data;
      populateTable(data);
      updateStatsFromData(data);
    } else {
      console.error("Beklenmeyen veri formatı:", data);
    }
  } catch (error) {
    console.error("Veri çekme hatası:", error);
    showToast("Veri alınamadı", "error");
  }
}

// İstatistikleri veriden güncelle
function updateStatsFromData(data) {
  const totalPrinters = data.length;
  let criticalTonerCount = 0;
  let offlineCount = 0;

  data.forEach((printer) => {
    // Her toner rengi için ayrı ayrı kontrol et
    if (printer.black && printer.black < 2) criticalTonerCount++;
    if (printer.cyan && printer.cyan < 2) criticalTonerCount++;
    if (printer.magenta && printer.magenta < 2) criticalTonerCount++;
    if (printer.yellow && printer.yellow < 2) criticalTonerCount++;

    // Offline yazıcıları say (status offline olanlar)
    if (printer.status === "offline") {
      offlineCount++;
    }
  });

  updateStats({
    totalPrinters,
    criticalCount: criticalTonerCount,
    offlineCount: offlineCount,
  });
}

// Durum etiketi oluştur
function getStatusLabel(percent) {
  if (percent < 10) return "Kritik";
  if (percent < 30) return "Düşük";
  return "NORMAL";
}

// Arama kutusuna odaklan
function focusSearch() {
  document.getElementById("searchInput").focus();
}

// Yazıcı ara
function searchPrinters() {
  const input = document.getElementById("searchInput");
  const filter = input.value.toUpperCase();
  const table = document.getElementById("printerTable");
  const tr = table.getElementsByTagName("tr");

  for (let i = 1; i < tr.length; i++) {
    let found = false;
    const tds = tr[i].getElementsByTagName("td");

    for (let j = 0; j < tds.length; j++) {
      if (tds[j]) {
        const txtValue = tds[j].textContent || tds[j].innerText;
        if (txtValue.toUpperCase().indexOf(filter) > -1) {
          found = true;
          break;
        }
      }
    }

    tr[i].style.display = found ? "" : "none";
  }
}

// Verileri yenile
function refreshData() {
  const refreshBtn = document.querySelector(".btn-refresh");
  refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yükleniyor...';

  // Backend'e yenileme isteği gönder
  fetch("/api/refresh-data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {
      refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Yenile';
      if (data.success) {
        showToast(data.message, "success");
      } else {
        showToast("Veri yenileme hatası", "error");
      }
    })
    .catch((error) => {
      console.error("Yenileme hatası:", error);
      refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Yenile';
      showToast("Veri yenileme hatası", "error");
    });
}

// Yazıcı silme fonksiyonu
function deletePrinter(ip) {
  if (confirm(`${ip} adresli yazıcıyı silmek istediğinizden emin misiniz?`)) {
    fetch(`/api/delete-printer/${ip}`, {
      method: "DELETE",
    })
      .then((response) => {
        if (response.ok) {
          showToast("Yazıcı başarıyla silindi!", "success");
          // Tabloyu ve istatistikleri yenile
          fetchPrinterData().then(() => {
            // İstatistikleri güncelle
            updateStatsFromData(window.currentPrinterData || []);
          });
        } else {
          showToast("Yazıcı silinirken hata oluştu!", "error");
        }
      })
      .catch((error) => {
        console.error("Silme hatası:", error);
        showToast("Yazıcı silinirken hata oluştu!", "error");
      });
  }
}

// Yazıcı ekle
function addPrinter() {
  const ipInput = document.getElementById("printerIp");
  const nameInput = document.getElementById("printerName");
  const ip = ipInput.value.trim();
  const name = nameInput.value.trim();

  if (!ip) {
    showToast("Lütfen IP adresi giriniz", "error");
    ipInput.focus();
    return;
  }

  if (!name) {
    showToast("Lütfen yazıcı adını giriniz", "error");
    nameInput.focus();
    return;
  }

  if (!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
    showToast("Lütfen geçerli bir IP adresi giriniz (örn: 192.168.1.100)", "error");
    ipInput.focus();
    return;
  }

  const addBtn = document.querySelector(".add-printer-form button");
  addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ekleniyor...';
  addBtn.disabled = true;

  // API çağrısı
  fetch("/api/add-printer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `ip=${encodeURIComponent(ip)}&name=${encodeURIComponent(name)}`,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        ipInput.value = "";
        nameInput.value = "";
        showToast(data.message, "success");
        // Tabloyu yenile ve yeni veriyi çek
        fetchPrinterData().then(() => {
          // İstatistikleri güncelle
          updateStatsFromData(window.currentPrinterData || []);
        });
      } else {
        showToast(data.error || "Yazıcı eklenirken hata oluştu!", "error");
      }
    })
    .catch((error) => {
      console.error("Ekleme hatası:", error);
      showToast(`Yazıcı eklenirken hata: ${error.message}`, "error");
    })
    .finally(() => {
      addBtn.innerHTML = '<i class="fas fa-plus"></i> Yazıcı Ekle';
      addBtn.disabled = false;
    });
}

// İstatistikleri güncelle
function updateStats(stats) {
  const statsContainer = document.getElementById("statsContainer");

  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Toplam Yazıcı</div>
      <div class="stat-value">${stats.totalPrinters}</div>
    </div>
    <div class="stat-card critical-card" onclick="showCriticalPrinters()" style="cursor: pointer;">
      <div class="stat-label">Kritik Toner Sayısı</div>
      <div class="stat-value" style="color: var(--danger-color);">${stats.criticalCount}</div>
    </div>
    <div class="stat-card offline-card" onclick="showOfflinePrinters()" style="cursor: pointer;">
      <div class="stat-label">Offline Yazıcı Sayısı</div>
      <div class="stat-value" style="color: #95a5a6;">${stats.offlineCount || 0}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Son Görülme</div>
      <div class="stat-value" id="lastRefreshTime">${new Date().toLocaleTimeString()}</div>
    </div>
  `;
}

// Son görülme zamanını güncelle
function updateLastRefreshTime(timestamp) {
  const lastRefreshElement = document.getElementById("lastRefreshTime");
  if (lastRefreshElement) {
    lastRefreshElement.textContent = timestamp;
  }
}

// Tabloyu doldur
function populateTable(printers) {
  const tableBody = document.querySelector("#printerTable tbody");
  tableBody.innerHTML = "";

  if (printers.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="8" style="text-align: center;">Kayıtlı yazıcı bulunamadı</td>`;
    tableBody.appendChild(row);
    return;
  }

  printers.forEach((printer) => {
    const row = document.createElement("tr");

    // Offline durumu kontrolü
    if (printer.status === "offline") {
      row.classList.add("offline-row");
    }

    // Tarih formatlama
    const lastModified = printer.lastModified
      ? new Date(printer.lastModified).toLocaleString("tr-TR")
      : "X";

    // Backend'den gelen kurum bilgisini kullan
    const unitName = printer.unit || "X";

    row.innerHTML = `
      <td>${unitName}</td>
      <td><a href="http://${printer.ip}" target="_blank" class="ip-link">${printer.ip}</a></td>
      <td>${lastModified}</td>
      <td class="toner-black" data-value="${printer.black ?? ""}">${createTonerCell({
      percent: printer.black,
      status: getStatusLabel(printer.black),
    })}</td>
      <td class="toner-cyan" data-value="${printer.cyan ?? ""}">${createTonerCell({
      percent: printer.cyan,
      status: getStatusLabel(printer.cyan),
    })}</td>
      <td class="toner-magenta" data-value="${printer.magenta ?? ""}">${createTonerCell({
      percent: printer.magenta,
      status: getStatusLabel(printer.magenta),
    })}</td>
      <td class="toner-yellow" data-value="${printer.yellow ?? ""}">${createTonerCell({
      percent: printer.yellow,
      status: getStatusLabel(printer.yellow),
    })}</td>
      <td>${printer.serialNo || "X"}</td>
      <td class="action-buttons">
        <button class="action-btn" onclick="showDetails('${printer.ip}', 'maintenance')">
          <i class="fas fa-tools"></i> Bakım
        </button>
        <button class="action-btn" onclick="showDetails('${printer.ip}', 'photoconductor')">
          <i class="fas fa-drum"></i> Fotokondüktör
        </button>
        <button class="action-btn" onclick="showConfigure('${printer.ip}')">
          <i class="fas fa-network-wired"></i>Config
        </button>
        <button class="action-btn delete-btn" onclick="deletePrinter('${printer.ip}')" title="Yazıcıyı Sil">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;

    tableBody.appendChild(row);
  });
}

// Tek bir toner hücresi oluştur
function createTonerCell(tonerData) {
  if (!tonerData || tonerData.percent === undefined || tonerData.percent === null) {
    return '<span style="color: #95a5a6;">X</span>';
  }

  const statusClass = tonerData.status
    ? `status-${tonerData.status.toLowerCase()}`
    : "status-unknown";
  const statusText = tonerData.status || "X";

  // Progress bar rengini belirle
  let progressColor = "#27ae60"; // Normal (yeşil)
  if (tonerData.percent < 10) {
    progressColor = "#e74c3c"; // Kritik (kırmızı)
  } else if (tonerData.percent < 30) {
    progressColor = "#f39c12"; // Düşük (turuncu)
  }

  return `
    <div style="width: 100%; background-color: #e0e0e0; border-radius: 4px; height: 20px; overflow: hidden; position: relative;">
      <div style="width: ${tonerData.percent}%; height: 100%; background-color: ${progressColor}; transition: width 0.3s ease;"></div>
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; color: black; font-weight: bold; font-size: 12px;">
        ${tonerData.percent}%
      </div>
    </div>
  `;
}

// Tablo sıralama fonksiyonları
function sortTable(columnIndex) {
  const table = document.getElementById("printerTable");
  if (!table) return;

  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll("tr"));
  if (!rows || rows.length === 0) return;

  // İşlemler sütununda sıralama yapma
  if (columnIndex === 8) return;

  // Aynı sütuna tekrar tıklanırsa sıralama yönünü değiştir
  if (currentSort.column === columnIndex) {
    currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
  } else {
    currentSort.column = columnIndex;
    currentSort.direction = "asc";
  }

  rows.sort((a, b) => {
    try {
      const aValue = getCellValue(a, columnIndex);
      const bValue = getCellValue(b, columnIndex);

      // Sayısal değerler için (toner yüzdeleri 3-6. sütunlar)
      if (columnIndex >= 3 && columnIndex <= 6) {
        return currentSort.direction === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Metin değerleri için (birim adı, IP, seri no)
      return currentSort.direction === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    } catch (e) {
      console.error("Sıralama hatası:", e);
      return 0;
    }
  });

  // Tabloyu yeniden oluştur
  tbody.innerHTML = "";
  rows.forEach((row) => {
    if (row) tbody.appendChild(row);
  });

  // Sıralama okunu güncelle
  updateSortArrow(columnIndex);
}

function getCellValue(row, columnIndex) {
  if (!row || !row.cells || columnIndex < 0 || columnIndex >= row.cells.length) {
    return columnIndex >= 3 && columnIndex <= 6 ? -1 : "";
  }

  const cell = row.cells[columnIndex];
  if (!cell) {
    return columnIndex >= 3 && columnIndex <= 6 ? -1 : "";
  }

  // Toner sütunları için (3-6. sütunlar)
  if (columnIndex >= 3 && columnIndex <= 6) {
    // data-value özelliğini kontrol et
    if (cell.hasAttribute("data-value")) {
      const value = cell.getAttribute("data-value");
      return value === "-" || value === "" ? -1 : parseFloat(value) || -1;
    }

    // Progress bar içindeki yüzde değerini çıkar
    const percentMatch = cell.textContent.match(/(\d+)%/);
    return percentMatch ? parseFloat(percentMatch[1]) : -1;
  }

  // Diğer sütunlar için normal değer
  return cell.textContent ? cell.textContent.trim() : "";
}

function updateSortArrow(columnIndex) {
  // Tüm başlıklardaki okları temizle
  const headers = document.querySelectorAll("#printerTable th");
  if (!headers) return;

  headers.forEach((th) => {
    if (th) th.classList.remove("sort-asc", "sort-desc");
  });

  // Aktif sütuna ok ekle (işlemler sütunu hariç)
  if (columnIndex !== 8) {
    const th = document.querySelector(`#printerTable th:nth-child(${columnIndex + 1})`);
    if (th) {
      th.classList.add(`sort-${currentSort.direction}`);
    }
  }
}

// Kritik tonerleri göster
function showCriticalPrinters() {
  const table = document.getElementById("printerTable");
  const tbody = table.querySelector("tbody");
  const rows = tbody.querySelectorAll("tr");
  const criticalCard = document.querySelector(".critical-card");

  let isShowingCritical = criticalCard.classList.contains("active");

  if (isShowingCritical) {
    // Tüm satırları göster
    rows.forEach((row) => {
      row.style.display = "";
    });
    criticalCard.classList.remove("active");
    criticalCard.querySelector(".stat-label").textContent = "Kritik Toner Sayısı";
  } else {
    // Sadece kritik tonerleri olan satırları göster
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 7) {
        const blackValue = parseFloat(cells[2].getAttribute("data-value") || 0);
        const cyanValue = parseFloat(cells[3].getAttribute("data-value") || 0);
        const magentaValue = parseFloat(cells[4].getAttribute("data-value") || 0);
        const yellowValue = parseFloat(cells[5].getAttribute("data-value") || 0);

        const hasCritical =
          (blackValue > 0 && blackValue < 2) ||
          (cyanValue > 0 && cyanValue < 2) ||
          (magentaValue > 0 && magentaValue < 2) ||
          (yellowValue > 0 && yellowValue < 2);

        row.style.display = hasCritical ? "" : "none";
      }
    });
    criticalCard.classList.add("active");
    criticalCard.querySelector(".stat-label").textContent = "Tümünü Göster";
  }
}

// Offline yazıcıları göster
function showOfflinePrinters() {
  const table = document.getElementById("printerTable");
  const tbody = table.querySelector("tbody");
  const rows = tbody.querySelectorAll("tr");
  const offlineCard = document.querySelector(".offline-card");

  let isShowingOffline = offlineCard.classList.contains("active");

  if (isShowingOffline) {
    // Tüm satırları göster
    rows.forEach((row) => {
      row.style.display = "";
    });
    offlineCard.classList.remove("active");
    offlineCard.querySelector(".stat-label").textContent = "Offline Yazıcı Sayısı";
  } else {
    // Sadece offline yazıcıları göster (offline-row class'ı olanlar)
    rows.forEach((row) => {
      const isOffline = row.classList.contains("offline-row");
      row.style.display = isOffline ? "" : "none";
    });
    offlineCard.classList.add("active");
    offlineCard.querySelector(".stat-label").textContent = "Tümünü Göster";
  }
}

// Config sayfasını aç
function showConfigure(ip) {
  // Yazıcının yapılandırma sayfası URL'si
  const configUrl = `http://${ip}/esf/prtappauth/admin/configureshellservlet?SelectedApp=ssa_network&RequestType=ExternalRequest`;

  // URL'nin geçerli olup olmadığını kontrol et
  try {
    new URL(configUrl); // URL geçerli mi diye kontrol
    window.open(configUrl, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.error("Geçersiz URL:", e);
    alert("Geçersiz yazıcı adresi veya yapılandırma sayfası bulunamadı!");
  }
}

// Detayları göster
function showDetails(ip, type) {
  const modal = document.getElementById("detailsModal");
  const modalContent = document.querySelector(".modal-content");

  let title = "";
  let content = "";

  if (type === "maintenance") {
    title = `${ip} - Bakım Kitleri`;
    content = createMaintenanceHtml(ip);
  } else if (type === "photoconductor") {
    title = `${ip} - Fotokondüktörler`;
    content = createPhotoconductorHtml(ip);
  }

  // Modal header'ı koru, sadece body'yi değiştir
  const modalHeader = modalContent.querySelector(".modal-header");
  modalContent.innerHTML = "";
  modalContent.appendChild(modalHeader);

  // Yeni content'i ekle
  const contentDiv = document.createElement("div");
  contentDiv.innerHTML = content;
  modalContent.appendChild(contentDiv);

  document.getElementById("modalTitle").textContent = title;
  modal.style.display = "block";

  // Verileri yükle
  if (type === "maintenance") {
    loadKitData(ip);
  } else if (type === "photoconductor") {
    loadPhotoconductorData(ip);
  }
}

// Bakım kiti HTML oluştur
function createMaintenanceHtml(ip) {
  return `
    <div class="modal-body">
      <div id="maintenanceContent">
        <div style="text-align: center; padding: 20px;">
          <i class="fas fa-spinner fa-spin"></i> Yükleniyor...
        </div>
      </div>
    </div>
  `;
}

// Fotokondüktör HTML oluştur
function createPhotoconductorHtml(ip) {
  return `
    <div class="modal-body">
      <div id="photoconductorContent">
        <div style="text-align: center; padding: 20px;">
          <i class="fas fa-spinner fa-spin"></i> Yükleniyor...
        </div>
      </div>
    </div>
  `;
}

// Kit verilerini yükle
function loadKitData(ip) {
  fetch(`/api/kit-data/${ip}`)
    .then((response) => response.json())
    .then((data) => {
      const content = document.getElementById("maintenanceContent");
      if (data.error) {
        content.innerHTML = `<p style="text-align: center; color: red;">${data.error}</p>`;
      } else {
        content.innerHTML = Object.entries(data)
          .map(([itemName, info]) => {
            let icon = "🔧"; // Varsayılan ikon
            let color = "#3498db"; // Varsayılan renk

            // İkon ve renk belirleme
            if (info.type === "developer") {
              icon = "⚫";
              color = "#2c3e50";
            } else if (info.type === "waste") {
              icon = "🗑️";
              color = "#95a5a6";
            } else if (info.type === "kit") {
              icon = "🔧";
              color = "#e67e22";
            }

            return `
              <div class="detail-item">
                <div class="detail-title">
                  <span style="font-size: 18px; margin-right: 8px;">${icon}</span>
                  ${itemName}
                  ${
                    info.serialNumber && info.serialNumber !== "Bilinmiyor"
                      ? `<br><small style="color: #7f8c8d;">Seri No: ${info.serialNumber}</small>`
                      : ""
                  }
                </div>
                <div class="progress-container">
                  <div class="progress-bar" style="width: ${info.percent}%; background-color: ${getStatusColor(
              info.percent
            )};">
                    ${info.percent}%
                  </div>
                </div>
                <p>Durum: <span class="status-badge status-${info.status.toLowerCase()}">${
              info.status
            }</span></p>
              </div>
            `;
          })
          .join("");
      }
    })
    .catch((error) => {
      const content = document.getElementById("maintenanceContent");
      content.innerHTML = `<p style="text-align: center; color: red;">Veri yüklenirken hata oluştu!</p>`;
    });
}

// Fotokondüktör verilerini yükle
function loadPhotoconductorData(ip) {
  fetch(`/api/photoconductor-data/${ip}`)
    .then((response) => response.json())
    .then((data) => {
      const content = document.getElementById("photoconductorContent");
      if (data.error) {
        content.innerHTML = `<p style="text-align: center; color: red;">${data.error}</p>`;
      } else {
        content.innerHTML = Object.entries(data)
          .map(
            ([color, info]) => `
              <div class="detail-item">
                <div class="detail-title">${color.charAt(0).toUpperCase() + color.slice(1)} Fotokondüktör</div>
                <div class="progress-container">
                  <div class="progress-bar" style="width: ${info.percentFull}%; background-color: ${getStatusColor(
              info.percentFull
            )};">
                    ${info.percentFull}%
                  </div>
                </div>
              </div>
            `
          )
          .join("");
      }
    })
    .catch((error) => {
      const content = document.getElementById("photoconductorContent");
      content.innerHTML = `<p style="text-align: center; color: red;">Veri yüklenirken hata oluştu!</p>`;
    });
}

function getStatusColor(percent) {
  if (percent === undefined || percent === null) return "#95a5a6";
  if (percent < 10) return "#e74c3c";
  if (percent < 30) return "#f39c12";
  return "#27ae60";
}

// Toast bildirimi göster
function showToast(message, type) {
  // Toast container oluştur
  let toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
    `;
    document.body.appendChild(toastContainer);
  }

  // Toast elementi oluştur
  const toast = document.createElement("div");
  toast.style.cssText = `
    background: ${
      type === "success"
        ? "#27ae60"
        : type === "error"
        ? "#e74c3c"
        : "#3498db"
    };
    color: white;
    padding: 12px 20px;
    margin-bottom: 10px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    font-size: 14px;
    font-weight: 500;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s ease;
    cursor: pointer;
  `;
  toast.textContent = message;

  // Toast'u ekle
  toastContainer.appendChild(toast);

  // Animasyon
  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(0)";
  }, 100);

  // 5 saniye sonra kaldır
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 5000);

  // Tıklayarak kapatma
  toast.addEventListener("click", () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  });
}

