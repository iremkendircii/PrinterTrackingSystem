# Yazıcı Toner Takip Sistemi

Bu proje, ağ yazıcılarının toner seviyelerini ve durumlarını takip etmek için geliştirilmiş bir web uygulamasıdır.

## 🚀 Özellikler

### ✅ Tamamlanan Özellikler

1. **Yazıcı Ekleme**: 
   - "Yazıcı Ekle" butonuna basınca girilen IP adresi `ips.txt` dosyasına eklenir
   - Yeni yazıcı eklendiğinde otomatik olarak veri çekilir

2. **Manuel Yenileme**: 
   - "Yenile" butonuna basınca `downloadAll.js` ve `generateSummary.js` çalışır
   - Tüm yazıcılardan güncel veriler çekilir

3. **Otomatik Yenileme**: 
   - Backend'de her 5 dakikada bir otomatik yenileme
   - Kritik toner seviyeleri için gerçek zamanlı bildirimler

4. **Gerçek Zamanlı Güncelleme**: 
   - Socket.io ile frontend'de "Son Görülme" zamanı güncellenir
   - Format: "GG/AA/YYYY SS:DD"

5. **Bildirim Sistemi**: 
   - Kritik toner seviyeleri için tarayıcı bildirimleri
   - Toast mesajları ile kullanıcı geri bildirimi

## 📁 Dosya Yapısı

```
PRINTER TRACKING SYSTEM/
├── server.js             # Sunucu başlatma dosyası
├── ips.txt               # Yazıcı IP adresleri ve isimleri
├── package.json          # Proje bağımlılıkları
├── package-lock.json     # Bağımlılık kilit dosyası
├── README.md             # Proje dokümantasyonu
├── summary.csv           # Yazıcı verilerinin özet çıktısı
├── json_outputs/         # Yazıcı verilerinin JSON dosyaları
├── public/               # Frontend dosyaları
│ ├── css/
│ │ └── style.css         # Stil dosyası
│ ├── js/
│ │ └── app.js            # Frontend JS dosyası
│ ├── index.html          # Ana frontend sayfası
│ └── login.html          # Giriş sayfası
├── routes/
│ └── printerRoutes.js    # Yazıcı API route dosyası
└── utils/
└── downloadAll.js        # Tüm IP'lerden veri çekme
└──generateSummary.js     # CSV ve özet oluşturma
```

## 🛠️ Kurulum

1. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   ```

2. **Uygulamayı başlatın:**
   ```bash
   node server.js 
   ```

3. **Tarayıcıda açın:**
   ```
   http://localhost:3000
   ```

## 🔧 Kullanım

### Yazıcı Ekleme
1. IP adresi ve yazıcı adını girin
2. "Yazıcı Ekle" butonuna basın
3. Yazıcı otomatik olarak `ips.txt`'ye eklenir ve veri çekilir

### Manuel Yenileme
1. "Yenile" butonuna basın
2. Tüm yazıcılardan güncel veriler çekilir
3. Frontend otomatik olarak güncellenir

### Otomatik Yenileme
- Her 5 dakikada bir otomatik olarak çalışır
- Kritik toner seviyeleri tespit edildiğinde bildirim gönderir

## 📊 Veri Formatları

### ips.txt Formatı
```
192.168.1.100 - Yazıcı Adı
192.168.1.101 - Başka Yazıcı
```

### JSON Çıktı Formatı
```json
{
  "ip": "192.168.1.100",
  "unit": "Yazıcı Adı",
  "lastModified": "2024-01-01T12:00:00.000Z",
  "black": 85,
  "cyan": 70,
  "magenta": 60,
  "yellow": 45,
  "serialNo": "ABC123456"
}
```

## 🔔 Bildirimler

- **Kritik Toner**: %2'nin altındaki toner seviyeleri
- **Offline Yazıcılar**: Veri çekilemeyen yazıcılar (30 dk)
- **Otomatik Yenileme**: Her 5 dakikada bir çalışır

## 🎯 Teknolojiler

- **Backend**: Node.js, Express.js
- **Frontend**: HTML, CSS, JavaScript
- **Gerçek Zamanlı**: Socket.io
- **HTTP İstekleri**: Axios
- **Dosya İşlemleri**: Node.js fs modülü

## 📝 Notlar

- Yazıcıların web arayüzü açık olmalıdır
- IP adresleri doğru formatta olmalıdır (xxx.xxx.xxx.xxx)
- Ağ bağlantısı gereklidir
- Kritik toner seviyeleri %2'nin altında bildirim gönderir

## 🚨 Sorun Giderme

1. **Yazıcıya erişim hatası**: Yazıcının açık olduğundan emin olun
2. **IP adresi bulunamadı**: IP adresinin doğru olduğunu kontrol edin
3. **Bağlantı reddedildi**: Yazıcının web arayüzünün açık olduğunu kontrol edin

## 📞 Destek

Herhangi bir sorun yaşarsanız, lütfen aşağıdaki bilgileri kontrol edin:
- Yazıcı IP adresinin doğruluğu
- Ağ bağlantısı
- Yazıcının açık olması
- Web arayüzünün erişilebilir olması
