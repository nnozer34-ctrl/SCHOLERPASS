# IPFS Setup Quickstart

Bu kılavuz IPFS sistemini hızlı şekilde ayarlamanızı sağlar.

## ⚡ 5 Dakikalık Setup

### Adım 1: Backend Bağımlılıkları Yükle

```bash
cd backend
npm install
```

### Adım 2: Ortam Dosyasını Oluştur

**Geliştirme (Mock Mode):**

```bash
cat > .env << EOF
PORT=4000
PINATA_JWT=
EOF
```

**Üretim (Gerçek Pinata):**

```bash
cat > .env << EOF
PORT=4000
PINATA_JWT=your_jwt_token_here_from_pinata
EOF
```

### Adım 3: Backend'i Başlat

```bash
npm run dev
# veya
npm start
```

Çıkti şu şekilde görünmeli:

```
╔══════════════════════════════════════════════════════════╗
║         Stellar ScholarPass Backend Started              ║
╚══════════════════════════════════════════════════════════╝

Backend: http://localhost:4000
Health:  http://localhost:4000/api/health

IPFS Mode: Mock (Development)
Database: backend/data/scholarpass.db
```

### Adım 4: Frontend'i Başlat (Ayrı terminal)

```bash
cd frontend
npm install  # İlk defa
npm run dev
```

### Adım 5: Sistem Sağlığını Kontrol Et

```bash
curl http://localhost:4000/api/health | jq .
```

---

## 🔐 Pinata Kurulumu (Opsiyonel)

Gerçek IPFS kullanmak istiyorsanız:

### 1. Pinata Hesabı Oluştur

1. https://www.pinata.cloud adresine gidin
2. "Sign Up" butonuna tıklayın
3. Email/password ile kayıt olun

### 2. JWT Token Oluştur

1. Dashboard → "API Keys"
2. "+ Create New" butonuna tıklayın
3. "Pinata API" seçin
4. "Create API Key" tıklayın
5. JWT token'ı kopyala

### 3. Token'ı .env Dosyasına Ekle

```bash
nano backend/.env
```

```env
PINATA_JWT=your_very_long_jwt_token_here
```

### 4. Backend'i Yeniden Başlat

```bash
# Backend terminalinde Ctrl+C ile durdur
npm run dev
```

Şimdi çıkılı şu şekilde görünmeli:

```
IPFS Mode: Pinata API (Real)
```

---

## ✅ Sistem Testi

### Test 1: Mock Mode Dosya Yükleme

```bash
# Bir test dosyası oluştur
echo "Test belgesi" > test.txt

# Upload et
curl -F "file=@test.txt" http://localhost:4000/api/ipfs/upload | jq .
```

Çıkılı şu şekilde görünmeli:

```json
{
  "cid": "bafy-local-abc123...",
  "filename": "test.txt",
  "size": 14,
  "gatewayUrl": "https://ipfs.io/ipfs/bafy-local-abc123...",
  "mocked": true
}
```

### Test 2: Yüklü Dosyaları Listele

```bash
curl http://localhost:4000/api/ipfs/uploads | jq .
```

### Test 3: Frontend Test

1. Browser: http://localhost:3000 (varsayılan Vite port)
2. Freighter cüzdanı bağlan
3. "ScholarPass" paneline git
4. Dosya yükle butonuna tıkla
5. Bir belge seç ve yükle

---

## 🐛 Sorun Giderme

### ❌ "Port 4000 already in use"

```bash
# Port'u bul
lsof -i :4000

# Process'i durdur
kill -9 <PID>

# Veya farklı port kullan
PORT=5000 npm run dev
```

### ❌ "PINATA_JWT token geçersiz"

- Token'ı Pinata'dan yeniden kopyala
- `.env` dosyasında kontrol et
- Backend'i yeniden başlat
- `npm start` üretim için

### ❌ "Dosya tipi desteklenmiyor"

İzin verilen türler:
- Images: PNG, JPG, GIF, WebP, SVG
- Documents: PDF, TXT, CSV
- Data: JSON, XML
- Archives: ZIP, GZIP

### ❌ "Dosya çok büyük (max 12MB)"

Dosyayı sıkıştır:

```bash
gzip dosya.pdf
```

---

## 📊 Veritabanını Kontrol Et

```bash
# SQLite CLI açan
sqlite3 backend/data/scholarpass.db

# İçindeki tabloları listele
.tables

# Yüklü dosyaları göster
SELECT filename, cid, mocked FROM ipfs_uploads;

# Çıkış
.exit
```

---

## 📝 Frontend'de Dosya Yükleme

### React Hook Örneği

```typescript
import { uploadToIpfs, validateFile } from "./lib/ipfs";

export function MyComponent() {
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Validasyon (opsiyonel)
      const error = validateFile(file);
      if (error) {
        alert(error.message);
        return;
      }

      // Yükle
      const result = await uploadToIpfs(file);
      console.log("CID:", result.cid);
      console.log("Mock:", result.mocked);
    } catch (err) {
      console.error("Upload başarısız:", err);
    }
  };

  return <input type="file" onChange={handleFileSelect} />;
}
```

---

## 🚀 Sonraki Adımlar

1. **Soroban Kontratı:**
   - ScholarPass kontratı CID'yi kaydet
   - Blockchain'e muhurleme yap

2. **Ek Features:**
   - Dosya açıklaması ekle
   - Çoklu dosya yükleme
   - Download/share fonksiyonları

3. **Production:**
   - Custom domain IPFS gateway'i kur
   - Pinata bandwidth yönetimi
   - Cache stratejileri

---

## 📞 Hızlı Kontrol Listesi

- [ ] Backend `.env` oluşturuldu
- [ ] `npm install` çalıştırıldı (backend ve frontend)
- [ ] Backend çalışıyor (port 4000)
- [ ] Frontend çalışıyor (port 3000/5173)
- [ ] Health endpoint yanıt veriyor
- [ ] Dosya yükleme test edildi
- [ ] Database'de kayıtlar var

Tümü kontrol ettiyseniz, IPFS sistemi hazır! 🎉
