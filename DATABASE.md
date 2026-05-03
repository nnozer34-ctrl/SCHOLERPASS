# Database Architecture - ScholarPass

ScholarPass, SQLite veritabanını kullanarak IPFS yüklemeleri ve başarı kayıtlarını yönetir.

---

## 📋 Schema (Tablo Yapısı)

### 1. ipfs_uploads

IPFS ağına yüklenen dosyaların kaydını tutarken.

```sql
CREATE TABLE ipfs_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cid TEXT NOT NULL UNIQUE,           -- IPFS Content Identifier
  filename TEXT NOT NULL,              -- Orijinal dosya adı
  size INTEGER NOT NULL,               -- Dosya boyutu (bytes)
  gateway_url TEXT NOT NULL,           -- Erişim URL'si
  mocked INTEGER NOT NULL DEFAULT 0,   -- 0=Gerçek (Pinata), 1=Mock (Dev)
  created_at TEXT NOT NULL             -- Yükleme tarihi
);

-- Indices
CREATE INDEX idx_ipfs_created ON ipfs_uploads(created_at);
CREATE INDEX idx_ipfs_mocked ON ipfs_uploads(mocked);
```

**Sütun Detayları:**
- `cid`: Unique IPFS CID (bafy... veya bafy-local-...)
- `gateway_url`: https://ipfs.io/ipfs/{cid}
- `mocked`: 1=Mock mode (geliştirme), 0=Gerçek (Pinata)

**Örnek Veri:**
```json
{
  "id": 1,
  "cid": "bafkrei...",
  "filename": "certificate.pdf",
  "size": 245000,
  "gateway_url": "https://ipfs.io/ipfs/bafkrei...",
  "mocked": 0,
  "created_at": "2026-05-02 19:29:23"
}
```

---

### 2. achievement_cache

Soroban smart contract'tan alınan başarı kayıtlarının cache'i.

```sql
CREATE TABLE achievement_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id TEXT NOT NULL,            -- Soroban contract adresi
  chain_id INTEGER,                     -- Blockchain ID
  student TEXT NOT NULL,                -- Öğrenci Stellar adresi (G...)
  issuer TEXT NOT NULL,                 -- Veren kurum Stellar adresi
  title TEXT NOT NULL,                  -- Başarı başlığı
  category TEXT NOT NULL,               -- Kategori (AI, Blockchain, vb.)
  issuer_name TEXT NOT NULL,            -- Veren kurum adı
  cid TEXT NOT NULL,                    -- İlgili IPFS dosya CID'i
  tx_hash TEXT,                         -- Blockchain transaction hash
  created_at TEXT NOT NULL              -- Kayıt tarihi
);

-- Indices
CREATE INDEX idx_achievement_student ON achievement_cache(student);
CREATE INDEX idx_achievement_issuer ON achievement_cache(issuer);
CREATE INDEX idx_achievement_cid ON achievement_cache(cid);
CREATE INDEX idx_achievement_created ON achievement_cache(created_at);
```

**Sütun Detayları:**
- `student`: G ile başlayan 56 karakter Stellar adres
- `issuer`: Sertifika verenin Stellar adresi
- `cid`: ipfs_uploads tablosunda var olmalı
- `tx_hash`: Soroban transaction'ın hash'i

**Örnek Veri:**
```json
{
  "id": 1,
  "contract_id": "CABC...",
  "chain_id": 1,
  "student": "GBNC...",
  "issuer": "GBWZ...",
  "title": "AI Development Expert",
  "category": "Artificial Intelligence",
  "issuer_name": "ScholarPass Academy",
  "cid": "bafkrei...",
  "tx_hash": "0x123abc...",
  "created_at": "2026-05-02 19:30:00"
}
```

---

### 3. database_metadata

Veritabanı meta bilgileri (version, initialized_at, vb.)

```sql
CREATE TABLE database_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Örnek Veri:**
```
key: "version", value: "1.0.0"
key: "initialized_at", value: "2026-05-02T10:00:00.000Z"
```

---

## 📊 Relasyonlar

```
ipfs_uploads (1)
     ↓
     └─────────── (N) achievement_cache
         cid field
```

**Not:** Foreign Key constraint şu anda SQL seviyesinde enforce edilmemektedir, ancak application level'de kontrol edilir.

---

## 🚀 Performans Optimizasyonları

### Indices
- ✅ `idx_ipfs_created`: Son yüklemeler sorgusu
- ✅ `idx_ipfs_mocked`: Mock vs Real ayırımı
- ✅ `idx_achievement_student`: Öğrenci başarıları sorgusu
- ✅ `idx_achievement_issuer`: Kurum başarıları sorgusu
- ✅ `idx_achievement_cid`: Dosya ilişkili başarıları
- ✅ `idx_achievement_created`: Zaman bazlı sorgular

### WAL Mode
- **Yazma-Ahead Logging** aktif: `PRAGMA journal_mode = WAL`
- Eş zamanlı okuma/yazma desteği
- Daha hızlı transaction'lar

### Foreign Keys
- ✅ `PRAGMA foreign_keys = ON` aktif
- Veri bütünlüğü garantisi

---

## 📈 Veri Taşıma Stratejisi

### Büyüme Tahmini

| Senaryo | 1 ay | 1 yıl | 5 yıl |
|---------|------|-------|-------|
| Orta | ~500 uploads | ~6K uploads | ~30K uploads |
| Yüksek | ~5K uploads | ~60K uploads | ~300K uploads |
| DB Size (Orta) | ~50 MB | ~600 MB | ~3 GB |

### Arşivleme Stratejisi

```sql
-- 1 yıllık veriyi archive et
CREATE TABLE achievement_archive AS
SELECT * FROM achievement_cache
WHERE created_at < datetime('now', '-1 year');

DELETE FROM achievement_cache
WHERE created_at < datetime('now', '-1 year');
```

---

## 🔍 Sık Sorgulamalar

### 1. Öğrenci Başarılarını Al

```sql
SELECT * FROM achievement_cache
WHERE student = 'GBNC...'
ORDER BY created_at DESC;
```

**Performance:** O(log N) - student index sayesinde

### 2. Son 30 Günün Yüklemeleri

```sql
SELECT * FROM ipfs_uploads
WHERE created_at > datetime('now', '-30 days')
ORDER BY created_at DESC;
```

**Performance:** O(log N) - created_at index

### 3. Kullanılmayan Dosyaları Bul

```sql
SELECT u.* FROM ipfs_uploads u
LEFT JOIN achievement_cache a ON u.cid = a.cid
WHERE a.id IS NULL;
```

**Performance:** O(N) - full scan (ender kullanım)

### 4. Kategori İstatistikleri

```sql
SELECT category, COUNT(*) as count
FROM achievement_cache
GROUP BY category
ORDER BY count DESC;
```

**Performance:** O(N) - index üzerinden GROUP BY

---

## 💾 Yedekleme Stratejisi

### Otomatik Backup

```bash
# Günlük backup
0 2 * * * cp /backend/data/scholarpass.db /backup/scholarpass-$(date +%Y%m%d).db

# Weekly archive
0 3 0 * * zip -j /backup/scholarpass-week-$(date +%Y%W).zip /backup/scholarpass-*.db
```

### Backup Verisi

- Database file: `scholarpass.db`
- WAL files: `scholarpass.db-wal`, `scholarpass.db-shm`
- Tüm dosyaları birlikte backup et

### Recovery

```bash
cp /backup/scholarpass-20260502.db /backend/data/scholarpass.db
# Backend'i restart et
```

---

## 🧹 Bakım İşlemleri

### VACUUM (Defragmentation)

```sql
-- DB size'ı optimize et
VACUUM;

-- Periyodik çalıştırılmalı (weekly)
PRAGMA optimize;
```

### Analyze (Query Optimization)

```sql
-- Index istatistikleri güncelle
ANALYZE;

-- Query planner'ı iyileştir
```

### Cleanup Eski Mock Dosyaları

```javascript
// Backend'de
cleanupOldMockUploads(db, 30); // 30 günden eski mock dosyaları sil
```

---

## 📊 API Endpoints

### Health Check
```
GET /api/health
```

Response:
```json
{
  "database": {
    "size": "15.45 MB",
    "integrity": true,
    "uploads": {
      "total": 3,
      "real": 2,
      "mock": 1,
      "totalSize": "0.45 MB"
    }
  }
}
```

### Admin Stats
```
GET /api/admin/stats
```

Response:
```json
{
  "uploads": {
    "byType": [
      { "type": "real", "count": 2 },
      { "type": "mock", "count": 1 }
    ],
    "byFormat": [
      { "extension": "txt", "count": 1 }
    ]
  }
}
```

### Upload Details
```
GET /api/ipfs/{cid}
```

Response:
```json
{
  "upload": { ... },
  "achievements": [ ... ],
  "relatedCount": 1
}
```

---

## ⚠️ Veri Bütünlüğü Kontrolleri

### Constraint Kontrolleri

1. **CID Uniqueness**
   - `ipfs_uploads.cid` UNIQUE
   - Duplicate upload'lar reddedilir

2. **Stellar Address Validation**
   - `achievement_cache.student` regex: `^G[A-Z2-7]{55}$`
   - `achievement_cache.issuer` regex: `^G[A-Z2-7]{55}$`
   - Backend'de validate edilir

3. **NOT NULL Fields**
   - Tüm kritik alanlar NOT NULL
   - Database level enforcement

### Referential Integrity (Application Level)

```javascript
// Achievement kaydı oluşturmadan önce
const upload = db.prepare("SELECT * FROM ipfs_uploads WHERE cid = ?").get(cid);
if (!upload) throw new Error("CID not found in IPFS uploads");
```

---

## 🔐 Güvenlik Özellikleri

- ✅ PRAGMA foreign_keys aktif
- ✅ Parameterized queries (SQL injection preventi)
- ✅ Input validation (Stellar address format)
- ✅ Database integrity checks
- ✅ Transaction support

---

## 📝 Migrations

Gelecekteki schema değişiklikleri için:

```javascript
// db-migrations.js
export const migrations = {
  "1.0.0": () => {
    // Initial schema (already exists)
  },
  "1.1.0": (db) => {
    // Add new table or column
    db.exec(`ALTER TABLE ipfs_uploads ADD COLUMN ...`);
  },
};
```

---

## 🎯 Best Practices

1. ✅ Indeksleri regularly analiz et: `ANALYZE`
2. ✅ Defragmentasyon: `VACUUM` (weekly)
3. ✅ Query optimization: `EXPLAIN QUERY PLAN`
4. ✅ Backups: Günlük off-site backup
5. ✅ Monitoring: Health check sık sık
6. ✅ Cleanup: Eski mock dosyaları 30 günde bir temizle
7. ✅ Testing: Production'a benzer veri hacmi ile test et

---

## 📞 Sorun Giderme

### DB is Locked

```
"database is locked"
```

**Çözüm:**
- WAL mode'u kontrol et
- Process'ı restart et
- Long-running transaction'ları kapat

### Corrupted Database

```
"database disk image is malformed"
```

**Çözüm:**
- Backup'ten restore et
- Integrity check: `PRAGMA integrity_check`
- VACUUM ve ANALYZE çalıştır

### Slow Queries

```
-- Analiz et
EXPLAIN QUERY PLAN SELECT ...;

-- İndex ekle veya optimize et
```

---

Database sistem şu anda **production-ready** 🎉
