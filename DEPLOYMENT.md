# ScholarPass - Deployment & Operations Guide

**Status: ✅ Production Ready**

---

## 🚀 System Architecture

ScholarPass, modern web teknolojileri ile blockchain güvenliğini birleştiren hibrit bir mimariye sahip:

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
│                    (React + TypeScript)                          │
└────────────┬────────────────────────────────────────────────────┘
             │
        ┌────▼──────┐
        │  Frontend  │
        │ :5173/3000 │
        └────┬──────┘
             │
        ┌────▼──────────────────────────────────────────────────┐
        │           Backend API (Express.js)                    │
        │              :4000                                    │
        ├──────────────────────────────────────────────────────┤
        │  /api/ipfs/*         - File uploads to IPFS           │
        │  /api/health         - System status                 │
        │  /api/achievements/* - Blockchain queries            │
        │  /api/admin/*        - Statistics & monitoring       │
        └────┬─────────────────────────────────────────────────┘
             │
    ┌────────┼─────────────┬─────────────┐
    │        │             │             │
┌───▼──┐  ┌──▼──┐  ┌──────▼────┐  ┌───▼──────┐
│IPFS  │  │ DB  │  │ Stellar   │  │ Soroban  │
│      │  │     │  │ Horizon   │  │ Contract │
│Pinata│  │SQLite   │ Network  │  │          │
│      │  │     │  │           │  │ (Testnet)│
└──────┘  └─────┘  └───────────┘  └──────────┘
```

---

## 📋 Bileşenler

### 1. Frontend (React + TypeScript + Vite)
- **Konum**: `/frontend`
- **Port**: 5173 (dev) / 3000 (production)
- **Sorumluluk**: User Interface, Freighter wallet integration
- **Başlatma**: `npm run dev` / `npm run build`

### 2. Backend (Node.js + Express)
- **Konum**: `/backend`
- **Port**: 4000
- **Sorumluluk**: IPFS uploads, database, Stellar/Soroban queries
- **Başlatma**: `npm run dev` / `npm start`

### 3. Database (SQLite)
- **Konum**: `/backend/data/scholarpass.db`
- **Tablolar**:
  - `ipfs_uploads` - File registry with CID
  - `achievement_cache` - Blockchain records
  - `database_metadata` - Version & init info

### 4. IPFS Network (Pinata Cloud)
- **Provider**: Pinata.cloud (Enterprise IPFS)
- **Auth**: JWT token in `.env`
- **CID Format**: bafy... (IPFS v2)

### 5. Smart Contract (Soroban)
- **Konum**: `/contracts/scholarpass`
- **Network**: Stellar Testnet
- **Fonksiyonlar**:
  - `initialize()` - Admin setup
  - `issue()` - Record achievement
  - `get_achievements()` - Query records
  - `is_issuer()` - Role check

---

## 🏗️ Quick Start (5 Dakika)

### Prerequisites
- Node.js 18+
- Git
- Freighter Wallet (Chrome extension)
- Pinata Account (optional, uses mock mode by default)

### 1. Setup

```bash
# Clone repo
git clone <repo-url>
cd Stellar-Template

# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configuration

**Backend `.env` oluştur** (`/backend/.env`):

```env
PORT=4000
PINATA_JWT=<your_jwt_token_here>
STELLAR_NETWORK=testnet
```

**Frontend `.env`** (`/frontend/.env.local`):

```env
VITE_SCHOLARPASS_CONTRACT_ID=<contract_address>
VITE_RPC_URL=https://soroban-testnet.stellar.org
```

### 3. Start Services

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Backend çalışıyor: http://localhost:4000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Frontend çalışıyor: http://localhost:5173
```

### 4. Verify

```bash
# Run tests
bash quick-test.sh

# Output:
# ✅ All critical systems operational!
# 📋 System Status:
#    ✓ Backend (Port 4000): Active
#    ✓ IPFS (Pinata): Connected
#    ✓ Database: Healthy
#    ✓ File Uploads: Working
```

---

## 📊 System Workflow

### İşlem Adımları (Step by Step)

#### 1. **Dosya Hazırlığı (Off-Chain)**

```
User selects PDF certificate
         ↓
Frontend: /src/components/ScholarPass.tsx
         ↓
uploadToIpfs(file)
         ↓
POST /api/ipfs/upload
         ↓
Backend validates & uploads to Pinata
         ↓
IPFS assigns CID (Content Identifier)
         ↓
CID returned to frontend: "bafkrei..."
```

**API Response:**
```json
{
  "cid": "bafkreihedjgame2644qzjtbdupfaokpywtlyb5tdnizwr4ozzrtej5c6wy",
  "filename": "certificate.pdf",
  "size": 245000,
  "gatewayUrl": "https://ipfs.io/ipfs/bafkrei...",
  "mocked": false
}
```

#### 2. **Akıllı Kontrat Entegrasyonu (On-Chain)**

```
User approves in Freighter Wallet
         ↓
issueAchievement(issuerAddress, input)
         ↓
Build Soroban transaction with:
  - issuer address
  - student address
  - title, category, issuerName
  - CID (from IPFS)
         ↓
Frontend signs with Freighter
         ↓
Send to Stellar network
         ↓
Soroban contract records:
  achievement = {
    id: 1,
    issuer: issuerAddress,
    student: studentAddress,
    cid: "bafkrei...",
    issued_ledger: 12345
  }
         ↓
Permanent record on blockchain ✓
```

#### 3. **Doğrulama Mantığı (Verification)**

```
Verifier queries contract:
  getAchievements(studentAddress)
         ↓
Contract returns:
  [{ cid: "bafkrei...", ... }]
         ↓
Verifier downloads from IPFS:
  https://ipfs.io/ipfs/bafkrei...
         ↓
Hash file content locally
  SHA256(file) = bafkrei...
         ↓
Compare hashes:
  Blockchain CID == Local CID ?
         ↓
Result: ✓ Document is authentic & unchanged
```

---

## 🔌 API Reference

### Health & Status

```bash
GET /api/health
```

**Response:**
```json
{
  "ok": true,
  "network": "testnet",
  "ipfs": {
    "mode": "pinata-api",
    "configured": true
  },
  "database": {
    "size": "0.05 MB",
    "integrity": true,
    "uploads": {
      "total": 4,
      "real": 3,
      "mock": 1
    }
  }
}
```

### IPFS Operations

```bash
# Upload file
POST /api/ipfs/upload
Content-Type: multipart/form-data
Body: { file: <binary> }

# List uploads
GET /api/ipfs/uploads?limit=50&offset=0

# Get upload details
GET /api/ipfs/{cid}

# Admin stats
GET /api/admin/stats
```

### Achievements

```bash
# Query achievements
GET /api/achievements/{studentAddress}

# Create achievement
POST /api/achievements
Body: {
  "contractId": "CABC...",
  "chainId": 1,
  "student": "GBNC...",
  "issuer": "GBWZ...",
  "title": "...",
  "category": "...",
  "issuerName": "...",
  "cid": "bafy..."
}
```

---

## 🛠️ Maintenance & Troubleshooting

### Common Issues

#### Backend Won't Start

```bash
# Port 4000 in use?
lsof -i :4000
kill -9 <PID>

# Then retry
npm run dev
```

#### IPFS Upload Fails

```bash
# Check Pinata token
echo $PINATA_JWT

# Verify file size < 12MB
ls -lh certificate.pdf

# Check network
curl https://api.pinata.cloud/ping
```

#### Database Issues

```bash
# Check integrity
curl http://localhost:4000/api/health

# Or manually:
sqlite3 backend/data/scholarpass.db
> PRAGMA integrity_check;
```

### Monitoring

```bash
# Real-time stats
watch -n 5 'curl -s http://localhost:4000/api/health | jq .database'

# Logs
tail -f backend/nohup.out
tail -f frontend/build.log
```

---

## 🚢 Production Deployment

### Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Backend
COPY backend/package*.json ./backend/
WORKDIR ./backend
RUN npm ci --production

# Frontend
WORKDIR /app
COPY frontend/package*.json ./frontend/
WORKDIR ./frontend
RUN npm ci --production && npm run build

# Start
CMD ["node", "../backend/server.js"]
```

**Deploy:**
```bash
docker build -t scholarpass .
docker run -p 4000:4000 -e PINATA_JWT=xxx scholarpass
```

### Environment Variables (Production)

```env
# Backend
NODE_ENV=production
PORT=4000
PINATA_JWT=<secure_token>

# Frontend (build-time)
VITE_API_URL=https://api.scholarpass.com
VITE_SCHOLARPASS_CONTRACT_ID=<contract_id>
VITE_RPC_URL=https://soroban.stellar.org
```

### Security Checklist

- [ ] PINATA_JWT in secure vault
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] HTTPS/TLS enforced
- [ ] Database backups enabled
- [ ] Firewall rules configured
- [ ] Monitoring & alerts set up

---

## 📈 Performance Optimization

### Database Optimization

```sql
-- Run weekly
VACUUM;
ANALYZE;
PRAGMA optimize;
```

### Cache Strategy

```javascript
// Cache recent achievements
const cache = new Map();
const TTL = 5 * 60 * 1000; // 5 minutes

// Check cache before DB query
if (cache.has(key) && Date.now() - cache.get(key).time < TTL) {
  return cache.get(key).data;
}
```

### CDN Configuration

Use CDN for static assets:
- `/frontend/dist/` → CloudFront / Vercel
- Keep `/api/*` on origin server

---

## 🔐 Security Best Practices

### Input Validation

✅ **All endpoints validate:**
- Stellar address format: `^G[A-Z2-7]{55}$`
- File MIME types (whitelist)
- File size limits (12MB max)
- CID format validation

### Database Security

✅ **Protections:**
- Parameterized queries (SQL injection prevention)
- Foreign key constraints enabled
- Integrity checks on startup
- Regular backups

### API Security

✅ **Features:**
- CORS restricted to localhost in dev
- Input sanitization
- Error handling (no sensitive info leakage)
- Rate limiting ready

---

## 📚 Additional Resources

- [IPFS Guide](./IPFS_GUIDE.md)
- [IPFS Quickstart](./IPFS_QUICKSTART.md)
- [Database Architecture](./DATABASE.md)
- [Project README](./README.md)

---

## 🎯 Success Criteria

✅ **System is production-ready when:**
1. All APIs respond within 200ms
2. Database integrity: OK
3. IPFS uploads: Working
4. Soroban contract: Deployed & callable
5. Frontend: No build errors
6. Tests: All passing

---

## 📞 Support & Issues

### Getting Help

1. **Check logs**: `backend/nohup.out`
2. **Run tests**: `bash quick-test.sh`
3. **Verify health**: `curl http://localhost:4000/api/health`

### Reporting Bugs

Include:
- Error message
- Steps to reproduce
- System info (OS, Node version)
- Relevant logs

---

**Status**: ✅ Fully Operational  
**Last Updated**: May 3, 2026  
**Version**: 1.0.0  
