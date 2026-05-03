# IPFS Integration Guide

ScholarPass projesi **IPFS (InterPlanetary File System)** ile entegredir. Bu doküman IPFS sisteminin nasıl çalıştığını ve Pinata ile nasıl ayarlanacağını açıklar.

## 📋 Mevcut Durum

### ✅ Tamamlanan Özellikler
- ✓ Backend IPFS upload endpoint'i (`/api/ipfs/upload`)
- ✓ Mock mode (geliştirme) desteği
- ✓ Pinata Cloud API entegrasyonu
- ✓ MIME type validasyonu (images, PDF, JSON, XML, vb.)
- ✓ Maksimum 12MB dosya boyutu sınırı
- ✓ SQLite veritabanında upload kaydı
- ✓ Frontend dosya yükleme arayüzü
- ✓ CID (Content Identifier) yönetimi
- ✓ Hata işleme ve logging

### 🔄 İş Akışı

```
Kullanıcı Dosya Seçer
        ↓
Frontend: uploadToIpfs(file)
        ↓
Backend: /api/ipfs/upload
        ↓
┌─────────────────────────────────┐
│   PINATA_JWT var mı?            │
└─────────────────────────────────┘
        ↙              ↘
    HAYIR             EVET
      ↓                ↓
  Mock Mode      Pinata API
      ↓                ↓
Fake CID         Real Upload
  Generate       to IPFS
      ↓                ↓
└─────────────────────────────────┘
        ↓
    Database
   Save Record
        ↓
Frontend: CID Alındı
        ↓
Soroban'a
  Muhurlemeye Hazır
```

---

## 🚀 Kurulum & Yapılandırma

### 1. Backend Ortam Değişkenleri

**`.env` dosyasını oluşturun** (backend klasöründe):

```bash
# Mock mode (geliştirme)
PORT=4000
PINATA_JWT=

# Gerçek IPFS (Pinata)
# PORT=4000
# PINATA_JWT=your_jwt_token_here
```

### 2. Pinata Cloud Hesabı (Gerçek IPFS için)

1. [Pinata Cloud](https://www.pinata.cloud) adresine gidin
2. Ücretsiz hesap oluşturun
3. API Keys → "Create New API Key" tıklayın
4. JWT token kopyalayın
5. `.env` dosyasında `PINATA_JWT=your_token` olarak ayarlayın

---

## 📡 API Endpoints

### 1. Dosya Yükleme

```bash
POST /api/ipfs/upload
Content-Type: multipart/form-data

Response (200):
{
  "cid": "bafy...",
  "filename": "document.pdf",
  "size": 1024000,
  "gatewayUrl": "https://ipfs.io/ipfs/bafy...",
  "mocked": false
}
```

**Desteklenen Dosya Türleri:**
- Images: JPEG, PNG, GIF, WebP, SVG
- Documents: PDF, TXT, CSV
- Data: JSON, XML
- Archives: ZIP, GZIP

**Boyut Sınırı:** 12 MB

### 2. Yüklü Dosyaları Listele

```bash
GET /api/ipfs/uploads?limit=50&offset=0&mocked=false

Response (200):
{
  "uploads": [
    {
      "cid": "bafy...",
      "filename": "cert.pdf",
      "size": 512000,
      "gatewayUrl": "https://ipfs.io/ipfs/bafy...",
      "mocked": false,
      "createdAt": "2026-05-02T10:30:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 15
  }
}
```

**Query Parameters:**
- `limit`: 1-100, varsayılan 50
- `offset`: Sayfa başlangıcı, varsayılan 0
- `mocked`: true/false, tüm sonuçlar döndürmek için atla

### 3. Sistem Sağlığı

```bash
GET /api/health

Response (200):
{
  "ok": true,
  "network": "testnet",
  "ipfs": {
    "mode": "mock|pinata-api",
    "configured": boolean
  },
  "database": {
    "uploads": {
      "total": 15,
      "real": 3,
      "mock": 12
    },
    "achievements": 5
  }
}
```

---

## 💻 Frontend Kullanımı

### IPFS Dosya Yükleme

```typescript
import { uploadToIpfs, validateFile } from "../lib/ipfs";

// Dosyayı seçme
const file = event.target.files?.[0];

// Validasyon (opsiyonel - backend da yapılır)
const error = validateFile(file);
if (error) {
  console.error(error.message);
  return;
}

// Yükleme
try {
  const result = await uploadToIpfs(file);
  console.log("CID:", result.cid);
  console.log("Gateway:", result.gatewayUrl);
} catch (err) {
  console.error("Upload başarısız:", err.message);
}
```

### IPFS Utilities

```typescript
import {
  formatFileSize,
  formatCid,
  getIpfsUrl,
  fetchIpfsStats,
  isValidCid,
} from "../lib/ipfs-utils";

// Dosya boyutunu format et
const readable = formatFileSize(1024000); // "1000 KB"

// CID'yi kısalt
const short = formatCid("bafy..."); // "bafy...   (16 karakter)"

// Gateway URL oluştur
const url = getIpfsUrl("bafy...", "ipfs");
// https://ipfs.io/ipfs/bafy...

// IPFS istatistiklerini getir
const stats = await fetchIpfsStats();
console.log(`${stats.real} gerçek, ${stats.mock} mock dosya`);

// CID doğrula
if (isValidCid("bafy...")) {
  console.log("Geçerli CID");
}
```

---

## 🔍 Logging & Debugging

### Backend Logs

Dosya yükleme sırasında backend konsolunda şu loglar görürsünüz:

```
[IPFS Mock] Uploading file: document.pdf (1024000 bytes)
[IPFS Real] Uploading to Pinata: document.pdf (1024000 bytes)
[IPFS Success] File uploaded: bafy...
[IPFS Error] Pinata API error: ...
[API Error] GET /api/ipfs/uploads: ...
```

### Health Check

Sistem durumunu kontrol etmek için:

```bash
curl http://localhost:4000/api/health | jq .
```

---

## 📊 Veritabanı

### ipfs_uploads Tablosu

```sql
CREATE TABLE ipfs_uploads (
  id INTEGER PRIMARY KEY,
  cid TEXT UNIQUE NOT NULL,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  gateway_url TEXT NOT NULL,
  mocked INTEGER (0=gerçek, 1=mock),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Sorgu Örnekleri

```sql
-- Tüm gerçek yüklemeleri göster
SELECT * FROM ipfs_uploads WHERE mocked = 0;

-- En son 10 yüklemeyi göster
SELECT * FROM ipfs_uploads ORDER BY id DESC LIMIT 10;

-- Mock dosyaların toplam boyutunu hesapla
SELECT SUM(size) as total_size FROM ipfs_uploads WHERE mocked = 1;

-- CID'ye göre dosyayı bul
SELECT * FROM ipfs_uploads WHERE cid = 'bafy...';
```

---

## 🛠️ Sorun Giderme

### Sorun: "PINATA_JWT token'ı geçersiz"

**Çözüm:**
1. Pinata'dan JWT token'ı yeniden al
2. `.env` dosyasında güncelle
3. Backend'i yeniden başlat

### Sorun: "Dosya tipi desteklenmiyor"

**Çözüm:**
- Yalnızca izin verilen dosya türleri yüklenebilir
- Desteklenen türler: Images, PDF, JSON, XML, CSV, TXT, ZIP, GZIP
- Dosyayı dönüştürüp tekrar deneyin

### Sorun: "Dosya çok büyük"

**Çözüm:**
- Maksimum boyut 12 MB
- Dosyayı sıkıştırmayı deneyin
- Daha küçük dosyalar yükleyin

### Mock Mode'de kalma

**Sorun:** `mocked: true` dosyalar görünüyor

**Çözüm:**
- PINATA_JWT ortam değişkeni boş mı kontrol et
- `.env` dosyasını kontrol et
- Backend'i yeniden başlat

---

## 📝 Best Practices

1. **Dosya Validasyonu:**
   - Frontend'de `validateFile()` kullanın
   - Backend da tekrar kontrol edilir
   - Boyut ve tip doğrulaması yapılır

2. **Error Handling:**
   - Upload başarısız oldu mu?
   - Hata mesajını göster
   - Tekrar denemeyi önce

3. **Performance:**
   - 12MB'den küçük dosyalar yükleyin
   - Büyük dosyaları önceden sıkıştırın
   - Çok sayıda yüklemeden kaçının

4. **Security:**
   - Yalnızca güvenli dosya türlerini kabul et
   - CID'yi doğrula
   - Dosya metadata'sını kontrol et

---

## 🔗 Kaynaklar

- [IPFS Documentation](https://docs.ipfs.io)
- [Pinata Documentation](https://docs.pinata.cloud)
- [CID Specification](https://github.com/multiformats/cid)
- [Content Addressing in IPFS](https://docs.ipfs.io/concepts/content-addressing/)

---

## 📞 Destek

Sorularınız mı var?
- Backend loglarını kontrol edin
- Health endpoint'ini ziyaret edin
- Tarayıcı konsolu hatalarını kontrol edin
- `.env` dosyasının doğru şekilde ayarlandığından emin olun
