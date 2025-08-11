# Yazıcı Toner Takip Sistemi 🖨️📊

Kurumsal ağlardaki yazıcıların toner seviyelerini, bakım durumlarını ve fotokondüktör bilgilerini gerçek zamanlı takip eden kapsamlı bir çözüm. BT ekiplerinin toner stok yönetimi ve bakım planlamasını optimize etmek için tasarlanmıştır.

## 🌟 Temel Özellikler

Anlık Toner Takibi - 4 renk toner seviyelerini gerçek zamanlı gösterim

Kritik Uyarı Sistemi - <%10 seviyeler için otomatik alarm

Dinamik Raporlama - CSV formatında detaylı raporlar

Çoklu Yazıcı Yönetimi - Tek arayüzden tüm ağ yazıcılarını izleme

Bakım Modülleri - Fotokondüktör ve bakım kiti ömür takibi

Mobil Uyumlu - Tüm cihazlardan erişim imkanı

## 🧩 Sistem Mimarisi

Diagram

A[Kullanıcı Arayüzü] -->|HTTP İstekleri| B[Express Sunucu]
B --> C[Yazıcılar]
B --> D[JSON Veri Depolama]
E[downloadAll.js] -->|Veri Toplama| C
E --> D
F[generateSummary.js] --> D
F --> G[CSV Raporlar]

## ⚙️ Teknik Özellikler

Frontend (index.html)
Dinamik tablolar ve sıralama

Gerçek zamanlı toner göstergeleri

Responsive tasarım (mobil uyumlu)

Toast bildirim sistemi

Filtreleme ve arama özellikleri

Backend (app.js)
REST API endpoint'leri:

GET /printer-data - Yazıcı verileri

DELETE /delete-printer/:ip - Yazıcı silme

POST /add-printer - Yeni yazıcı ekleme

GET /summary.csv - CSV rapor indirme

IP doğrulama ve hata yönetimi

JSON tabanlı veri depolama

Yardımcı Scriptler
downloadAll.js - Yazıcılardan veri çekme ve JSON'a kaydetme

generateSummary.js - JSON verilerini CSV raporuna dönüştürme

## 🚀 Kurulum

Ön Gereksinimler
Node.js v16+
NPM v8+

Adım Adım Kurulum

Depoyu klonlayın:

git clone https://github.com/kullaniciadi/yazici-toner-takip.git
cd yazici-toner-takip

Bağımlılıkları yükleyin:
npm install express axios body-parser

Yazıcı IP'lerini ips.txt dosyasına ekleyin:

192.168.1.10 - Muhasebe
192.168.1.11 - İnsan Kaynakları

Sunucuyu başlatın:

node app.js

Tarayıcınızda açın:

http://localhost:3000

## 📊 Veri Toplama ve Raporlama

Otomatik Veri Toplama

node downloadAll.js
Bu komut ips.txt'de listelenen tüm yazıcılardan verileri çeker ve json_outputs/ klasörüne kaydeder.

CSV Rapor Oluşturma

node generateSummary.js
Oluşturulan summary.csv raporu Excel'de açılarak toner durumları analiz edilebilir.

## 📝 Kullanım Kılavuzu

Yazıcı Ekleme
Arayüzde "Yazıcı Ekle" butonuna tıklayın

IP adresi ve açıklama girin

Kaydet butonuna basın

Kritik Toner Uyarıları
<%10 seviyenin altına düşen tonerler:

Kırmızı arka planla vurgulanır

"KRİTİK" etiketi gösterilir

Ana istatistik panelinde kırmızı renkte sayısal değer

Rapor İndirme
"Rapor İndir" butonu ile tüm yazıcıların toner ve bakım durumlarını içeren CSV dosyasını indirin.

## 🛠️ Hata Yönetimi

Hata Kodu Açıklama Çözüm
ECONNREFUSED Bağlantı reddedildi Yazıcı IP'sini ve ağ erişimini kontrol edin
ENOTFOUND Yazıcı bulunamadı IP adresini doğrulayın
ETIMEDOUT Bağlantı zaman aşımına uğradı Yazıcının ağ bağlantısını kontrol edin
EACCES Dosya yazma hatası json_outputs/ klasörüne yazma izni verin

## 🌍 Kullanım Senaryoları

BT Yöneticileri: Toner stok planlaması ve acil müdahale

Satın Alma Birimi: Kritik tonerler için otomatik sipariş tetikleme

Şube Yönetimi: Lokasyon bazlı toner tüketim analizi

Bakım Ekipleri: Parça ömür takibi ve proaktif bakım planlama

## 📄 Lisans

Bu proje MIT Lisansı altında dağıtılmaktadır.

## ✨ Katkıda Bulunma

Hata raporları ve özellik istekleri için Issues bölümünü kullanabilirsiniz. Pull request'ler her zaman açıktır!

Sistem Mimarisi: Node.js · Express · Axios · Vanilla JS
Versiyon: 1.2.0
Güncelleme Tarihi: 7 Ağustos 2025
