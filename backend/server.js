import express from "express";
import cors from "cors";
import multer from "multer";
import crypto from "node:crypto";
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { Horizon, Networks } from "@stellar/stellar-sdk";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 4000;
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "data");
mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(join(dataDir, "scholarpass.db"));

// Enable foreign keys
db.exec("PRAGMA foreign_keys = ON");

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS ipfs_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cid TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    gateway_url TEXT NOT NULL,
    mocked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS achievement_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id TEXT NOT NULL,
    chain_id INTEGER,
    student TEXT NOT NULL,
    issuer TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    issuer_name TEXT NOT NULL,
    cid TEXT NOT NULL,
    tx_hash TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_achievement_student
    ON achievement_cache(student);
  
  CREATE INDEX IF NOT EXISTS idx_achievement_issuer
    ON achievement_cache(issuer);
  
  CREATE INDEX IF NOT EXISTS idx_achievement_cid
    ON achievement_cache(cid);
  
  CREATE INDEX IF NOT EXISTS idx_achievement_created
    ON achievement_cache(created_at);
  
  CREATE INDEX IF NOT EXISTS idx_ipfs_created
    ON ipfs_uploads(created_at);
  
  CREATE INDEX IF NOT EXISTS idx_ipfs_mocked
    ON ipfs_uploads(mocked);
  
  CREATE TABLE IF NOT EXISTS database_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Initialize metadata if not exists
const metadataCheck = db.prepare("SELECT COUNT(*) as count FROM database_metadata WHERE key = 'version'").get();
if (metadataCheck.count === 0) {
  db.prepare(
    "INSERT INTO database_metadata (key, value) VALUES (?, ?)"
  ).run("version", "1.0.0");
  db.prepare(
    "INSERT INTO database_metadata (key, value) VALUES (?, ?)"
  ).run("initialized_at", new Date().toISOString());
}

seedDemoUpload();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Allowed MIME types for IPFS (documents, images, JSON)
    const allowedMimeTypes = [
      // Images
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      // Documents
      "application/pdf",
      "text/plain",
      "text/csv",
      // Data
      "application/json",
      "application/xml",
      "text/xml",
      // Archives
      "application/zip",
      "application/gzip",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Dosya tipi desteklenmiyor: ${file.mimetype}`));
    }
  },
});

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");

app.use(cors({ origin: /^http:\/\/localhost:30\d{2}$/ }));
app.use(express.json());

// Multer error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "FILE_TOO_LARGE") {
      return res.status(413).json({ error: "Dosya çok büyük (max 12MB)" });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "Çok fazla dosya" });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message && err.message.includes("Dosya tipi")) {
    return res.status(415).json({ error: err.message });
  }
  next(err);
});

app.get("/api/health", (_req, res) => {
  try {
    const uploadCount = db.prepare("SELECT COUNT(*) AS count FROM ipfs_uploads").get();
    const mockCount = db.prepare("SELECT COUNT(*) AS count FROM ipfs_uploads WHERE mocked = 1").get();
    const realCount = db.prepare("SELECT COUNT(*) AS count FROM ipfs_uploads WHERE mocked = 0").get();
    const achievementCount = db
      .prepare("SELECT COUNT(*) AS count FROM achievement_cache")
      .get();

    // Calculate total IPFS storage
    const totalSize = db.prepare("SELECT COALESCE(SUM(size), 0) AS total FROM ipfs_uploads").get();
    const realSize = db.prepare("SELECT COALESCE(SUM(size), 0) AS total FROM ipfs_uploads WHERE mocked = 0").get();

    // Get database size
    const dbPath = join(dataDir, "scholarpass.db");
    const dbSize = statSync(dbPath).size;

    const pinataConfigured = !!process.env.PINATA_JWT;

    // Database integrity check
    const integrity = db.prepare("PRAGMA integrity_check").get();
    const dbIntegrity = integrity.integrity_check === "ok";

    res.json({
      ok: true,
      network: "testnet",
      ipfs: {
        mode: pinataConfigured ? "pinata-api" : "mock",
        configured: pinataConfigured,
      },
      database: {
        path: "backend/data/scholarpass.db",
        size: `${(dbSize / 1024 / 1024).toFixed(2)} MB`,
        integrity: dbIntegrity,
        uploads: {
          total: uploadCount.count,
          real: realCount.count,
          mock: mockCount.count,
          totalSize: `${(totalSize.total / 1024 / 1024).toFixed(2)} MB`,
          realSize: `${(realSize.total / 1024 / 1024).toFixed(2)} MB`,
        },
        achievements: achievementCount.count,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[API Error] GET /api/health:`, err.message);
    res.status(500).json({ error: "Health check failed", timestamp: new Date().toISOString() });
  }
});

app.get("/api/account/:address", async (req, res) => {
  const { address } = req.params;

  if (!/^G[A-Z2-7]{55}$/.test(address)) {
    return res.status(400).json({ error: "Geçersiz Stellar adresi" });
  }

  try {
    const account = await horizon.loadAccount(address);
    const xlm = account.balances.find((b) => b.asset_type === "native");
    const tokens = account.balances.filter((b) => b.asset_type !== "native");

    return res.json({
      address,
      xlmBalance: xlm?.balance ?? "0",
      sequence: account.sequence,
      subentryCount: account.subentry_count,
      tokens: tokens.map((t) => ({
        asset: `${t.asset_code}:${t.asset_issuer}`,
        balance: t.balance,
      })),
      networkPassphrase: Networks.TESTNET,
    });
  } catch (err) {
    if (err?.response?.status === 404) {
      return res.status(404).json({ error: "Hesap bulunamadı (fonlanmamış)" });
    }
    console.error(err);
    return res.status(500).json({ error: "Horizon bağlantı hatası" });
  }
});

app.post("/api/ipfs/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Dosya bulunamadi" });
  }

  try {
    const jwt = process.env.PINATA_JWT;

    if (!jwt) {
      // Mock mode for development
      console.log(`[IPFS Mock] Uploading file: ${req.file.originalname} (${req.file.size} bytes)`);

      const digest = crypto
        .createHash("sha256")
        .update(req.file.buffer)
        .digest("hex")
        .slice(0, 46);

      const uploadRecord = saveUpload({
        cid: `bafy-local-${digest}`,
        filename: req.file.originalname,
        size: req.file.size,
        gatewayUrl: `https://ipfs.io/ipfs/bafy-local-${digest}`,
        mocked: true,
      });

      return res.json(uploadRecord);
    }

    // Real Pinata upload
    console.log(`[IPFS Real] Uploading to Pinata: ${req.file.originalname} (${req.file.size} bytes)`);

    const body = new FormData();
    body.append(
      "file",
      new Blob([req.file.buffer], { type: req.file.mimetype }),
      req.file.originalname
    );
    body.append(
      "pinataMetadata",
      JSON.stringify({
        name: req.file.originalname,
        keyvalues: {
          app: "ScholarPass",
          network: "stellar-testnet",
          timestamp: new Date().toISOString(),
        },
      })
    );
    body.append(
      "pinataOptions",
      JSON.stringify({
        cidVersion: 1,
      })
    );

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const payload = await response.json();

    if (!response.ok) {
      const errorMsg = payload?.error?.details ?? payload?.error ?? "Pinata yukleme hatasi";
      console.error(`[IPFS Error] Pinata API error:`, errorMsg);
      return res.status(response.status).json({ error: errorMsg });
    }

    if (!payload.IpfsHash) {
      console.error(`[IPFS Error] No IpfsHash in Pinata response:`, payload);
      return res.status(500).json({ error: "Pinata'dan geçersiz yanıt alındı" });
    }

    const uploadRecord = saveUpload({
      cid: payload.IpfsHash,
      filename: req.file.originalname,
      size: req.file.size,
      gatewayUrl: `https://ipfs.io/ipfs/${payload.IpfsHash}`,
      mocked: false,
    });

    console.log(`[IPFS Success] File uploaded: ${uploadRecord.cid}`);
    return res.json(uploadRecord);
  } catch (err) {
    console.error(`[IPFS Error] Upload failed:`, err.message);
    return res.status(500).json({ error: err.message || "IPFS baglanti hatasi" });
  }
});

app.get("/api/ipfs/uploads", (_req, res) => {
  try {
    const limit = Math.min(parseInt(_req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(_req.query.offset) || 0, 0);
    const mocked = _req.query.mocked; // undefined, "true", or "false"

    let query = `SELECT cid, filename, size, gateway_url AS gatewayUrl, mocked, created_at AS createdAt
                 FROM ipfs_uploads`;
    const params = [];

    if (mocked !== undefined) {
      query += ` WHERE mocked = ?`;
      params.push(mocked === "true" ? 1 : 0);
    }

    query += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const uploads = db
      .prepare(query)
      .all(...params)
      .map((upload) => ({ ...upload, mocked: Boolean(upload.mocked) }));

    // Get total count
    let countQuery = "SELECT COUNT(*) AS total FROM ipfs_uploads";
    const countParams = [];
    if (mocked !== undefined) {
      countQuery += ` WHERE mocked = ?`;
      countParams.push(mocked === "true" ? 1 : 0);
    }
    const countResult = db
      .prepare(countQuery)
      .get(...countParams);

    res.json({
      uploads,
      pagination: {
        limit,
        offset,
        total: countResult.total,
      },
    });
  } catch (err) {
    console.error(`[API Error] GET /api/ipfs/uploads:`, err.message);
    res.status(500).json({ error: "Yüklemeler alınamadı" });
  }
});

app.post("/api/achievements", (req, res) => {
  const {
    contractId,
    chainId,
    student,
    issuer,
    title,
    category,
    issuerName,
    cid,
    txHash,
  } = req.body ?? {};

  if (!isStellarAddress(student) || !isStellarAddress(issuer)) {
    return res.status(400).json({ error: "Gecersiz Stellar adresi" });
  }

  if (!contractId || !title || !category || !issuerName || !cid) {
    return res.status(400).json({ error: "Eksik basari verisi" });
  }

  const result = db
    .prepare(
      `INSERT INTO achievement_cache (
        contract_id, chain_id, student, issuer, title, category, issuer_name, cid, tx_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      contractId,
      Number.isFinite(Number(chainId)) ? Number(chainId) : null,
      student,
      issuer,
      title,
      category,
      issuerName,
      cid,
      txHash ?? null
    );

  res.status(201).json({ id: result.lastInsertRowid });
});

app.get("/api/achievements/:student", (req, res) => {
  const { student } = req.params;
  if (!isStellarAddress(student)) {
    return res.status(400).json({ error: "Gecersiz Stellar adresi" });
  }

  const achievements = db
    .prepare(
      `SELECT
        id, contract_id AS contractId, chain_id AS chainId, student, issuer,
        title, category, issuer_name AS issuerName, cid, tx_hash AS txHash,
        created_at AS createdAt
       FROM achievement_cache
       WHERE student = ?
       ORDER BY created_at DESC`
    )
    .all(student);

  res.json({ achievements });
});

// Database statistics endpoint
app.get("/api/admin/stats", (req, res) => {
  try {
    const stats = {
      uploads: {
        total: db.prepare("SELECT COUNT(*) as count FROM ipfs_uploads").get().count,
        byType: db.prepare(`
          SELECT 
            CASE 
              WHEN mocked = 1 THEN 'mock'
              ELSE 'real'
            END as type,
            COUNT(*) as count,
            SUM(size) as totalSize
          FROM ipfs_uploads
          GROUP BY mocked
        `).all(),
        byFormat: db.prepare(`
          SELECT 
            SUBSTR(filename, INSTR(filename, '.') + 1) as extension,
            COUNT(*) as count
          FROM ipfs_uploads
          WHERE INSTR(filename, '.') > 0
          GROUP BY extension
          ORDER BY count DESC
          LIMIT 10
        `).all(),
      },
      achievements: {
        total: db.prepare("SELECT COUNT(*) as count FROM achievement_cache").get().count,
        byCategory: db.prepare(`
          SELECT category, COUNT(*) as count
          FROM achievement_cache
          GROUP BY category
          ORDER BY count DESC
        `).all(),
        byIssuer: db.prepare(`
          SELECT issuer, COUNT(*) as count
          FROM achievement_cache
          GROUP BY issuer
          ORDER BY count DESC
          LIMIT 10
        `).all(),
        recentWeek: db.prepare(`
          SELECT COUNT(*) as count
          FROM achievement_cache
          WHERE created_at > datetime('now', '-7 days')
        `).get().count,
      },
      database: {
        uploadsDiskUsage: `${(db.prepare("SELECT COALESCE(SUM(size), 0) as total FROM ipfs_uploads").get().total / 1024 / 1024).toFixed(2)} MB`,
        recordCount: {
          uploads: db.prepare("SELECT COUNT(*) as count FROM ipfs_uploads").get().count,
          achievements: db.prepare("SELECT COUNT(*) as count FROM achievement_cache").get().count,
        },
      },
    };

    res.json(stats);
  } catch (err) {
    console.error(`[API Error] GET /api/admin/stats:`, err.message);
    res.status(500).json({ error: "Stats unavailable" });
  }
});

// Get upload details by CID
app.get("/api/ipfs/:cid", (req, res) => {
  try {
    const { cid } = req.params;

    const upload = db.prepare(
      `SELECT * FROM ipfs_uploads WHERE cid = ?`
    ).get(cid);

    if (!upload) {
      return res.status(404).json({ error: "Upload not found" });
    }

    // Get related achievements
    const achievements = db.prepare(
      `SELECT * FROM achievement_cache WHERE cid = ?`
    ).all(cid);

    res.json({
      upload: {
        ...upload,
        mocked: Boolean(upload.mocked),
      },
      achievements,
      relatedCount: achievements.length,
    });
  } catch (err) {
    console.error(`[API Error] GET /api/ipfs/:cid:`, err.message);
    res.status(500).json({ error: "Failed to fetch upload details" });
  }
});

function saveUpload(upload) {
  db.prepare(
    `INSERT INTO ipfs_uploads (cid, filename, size, gateway_url, mocked)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cid) DO UPDATE SET
       filename = excluded.filename,
       size = excluded.size,
       gateway_url = excluded.gateway_url,
       mocked = excluded.mocked`
  ).run(upload.cid, upload.filename, upload.size, upload.gatewayUrl, upload.mocked ? 1 : 0);

  return upload;
}

function seedDemoUpload() {
  saveUpload({
    cid: "bafy-scholarpass-demo",
    filename: "scholarpass-demo.json",
    size: 174,
    gatewayUrl: "https://ipfs.io/ipfs/bafy-scholarpass-demo",
    mocked: true,
  });
}

function isStellarAddress(address) {
  return typeof address === "string" && /^G[A-Z2-7]{55}$/.test(address);
}

app.listen(PORT, () => {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║         Stellar ScholarPass Backend Started              ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`Backend: http://localhost:${PORT}`);
  console.log(`Health:  http://localhost:${PORT}/api/health`);
  console.log(`\nIPFS Mode: ${process.env.PINATA_JWT ? "Pinata API (Real)" : "Mock (Development)"}`);
  console.log(`Database: ${join(dataDir, "scholarpass.db")}\n`);
});
