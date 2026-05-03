/**
 * Database Utilities - ScholarPass Database Management
 * Handles IPFS uploads and achievement cache operations
 */

/**
 * Database initialization with proper schema and indices
 */
export function initializeDatabase(db) {
    // Enable foreign keys
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA journal_mode = WAL"); // Write-Ahead Logging for better concurrency

    // Initialize schema
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
}

/**
 * Validate Stellar address format
 */
export function isStellarAddress(address) {
    return typeof address === "string" && /^G[A-Z2-7]{55}$/.test(address);
}

/**
 * Get database health metrics
 */
export function getDatabaseMetrics(db) {
    try {
        const uploadCount = db.prepare("SELECT COUNT(*) AS count FROM ipfs_uploads").get();
        const mockCount = db.prepare("SELECT COUNT(*) AS count FROM ipfs_uploads WHERE mocked = 1").get();
        const realCount = db.prepare("SELECT COUNT(*) AS count FROM ipfs_uploads WHERE mocked = 0").get();
        const achievementCount = db.prepare("SELECT COUNT(*) AS count FROM achievement_cache").get();

        const totalSize = db.prepare("SELECT COALESCE(SUM(size), 0) AS total FROM ipfs_uploads").get();
        const realSize = db.prepare("SELECT COALESCE(SUM(size), 0) AS total FROM ipfs_uploads WHERE mocked = 0").get();

        return {
            uploads: {
                total: uploadCount.count,
                real: realCount.count,
                mock: mockCount.count,
                totalSize: totalSize.total,
                realSize: realSize.total,
            },
            achievements: achievementCount.count,
        };
    } catch (err) {
        console.error("Error getting database metrics:", err);
        return null;
    }
}

/**
 * Get database integrity status
 */
export function checkDatabaseIntegrity(db) {
    try {
        const result = db.prepare("PRAGMA integrity_check").get();
        return result.integrity_check === "ok";
    } catch (err) {
        console.error("Error checking database integrity:", err);
        return false;
    }
}

/**
 * Get detailed upload statistics
 */
export function getUploadStats(db) {
    try {
        return {
            byFormat: db.prepare(`
        SELECT 
          SUBSTR(filename, INSTR(filename, '.') + 1) as extension,
          COUNT(*) as count,
          COALESCE(SUM(size), 0) as totalSize
        FROM ipfs_uploads
        WHERE INSTR(filename, '.') > 0
        GROUP BY extension
        ORDER BY count DESC
      `).all(),
            byType: db.prepare(`
        SELECT 
          CASE 
            WHEN mocked = 1 THEN 'mock'
            ELSE 'real'
          END as type,
          COUNT(*) as count,
          COALESCE(SUM(size), 0) as totalSize
        FROM ipfs_uploads
        GROUP BY mocked
      `).all(),
            timeline: db.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          COALESCE(SUM(size), 0) as totalSize
        FROM ipfs_uploads
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `).all(),
        };
    } catch (err) {
        console.error("Error getting upload stats:", err);
        return null;
    }
}

/**
 * Get detailed achievement statistics
 */
export function getAchievementStats(db) {
    try {
        return {
            byCategory: db.prepare(`
        SELECT category, COUNT(*) as count
        FROM achievement_cache
        GROUP BY category
        ORDER BY count DESC
      `).all(),
            byIssuer: db.prepare(`
        SELECT issuer, COUNT(*) as count, issuer_name
        FROM achievement_cache
        GROUP BY issuer
        ORDER BY count DESC
        LIMIT 20
      `).all(),
            timeline: db.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM achievement_cache
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `).all(),
            recentStats: {
                today: db.prepare(`
          SELECT COUNT(*) as count FROM achievement_cache 
          WHERE DATE(created_at) = DATE('now')
        `).get().count,
                week: db.prepare(`
          SELECT COUNT(*) as count FROM achievement_cache 
          WHERE created_at > datetime('now', '-7 days')
        `).get().count,
                month: db.prepare(`
          SELECT COUNT(*) as count FROM achievement_cache 
          WHERE created_at > datetime('now', '-30 days')
        `).get().count,
            },
        };
    } catch (err) {
        console.error("Error getting achievement stats:", err);
        return null;
    }
}

/**
 * Find unused IPFS uploads (not referenced by any achievement)
 */
export function findUnusedUploads(db) {
    try {
        return db.prepare(`
      SELECT 
        u.id, u.cid, u.filename, u.size, u.created_at,
        COUNT(a.id) as achievementCount
      FROM ipfs_uploads u
      LEFT JOIN achievement_cache a ON u.cid = a.cid
      GROUP BY u.id
      HAVING achievementCount = 0
      ORDER BY u.created_at DESC
    `).all();
    } catch (err) {
        console.error("Error finding unused uploads:", err);
        return null;
    }
}

/**
 * Get student achievements with upload details
 */
export function getStudentProfile(db, studentAddress) {
    if (!isStellarAddress(studentAddress)) {
        throw new Error("Invalid Stellar address");
    }

    try {
        const achievements = db.prepare(`
      SELECT 
        a.id, a.contract_id, a.chain_id, a.student, a.issuer,
        a.title, a.category, a.issuer_name, a.cid, a.tx_hash,
        a.created_at,
        u.size as fileSize, u.mocked as fileMocked,
        u.gateway_url as fileGateway
      FROM achievement_cache a
      LEFT JOIN ipfs_uploads u ON a.cid = u.cid
      WHERE a.student = ?
      ORDER BY a.created_at DESC
    `).all(studentAddress);

        return {
            student: studentAddress,
            achievementCount: achievements.length,
            categories: [...new Set(achievements.map(a => a.category))],
            issuers: [...new Set(achievements.map(a => a.issuer))],
            achievements,
        };
    } catch (err) {
        console.error("Error getting student profile:", err);
        return null;
    }
}

/**
 * Export database backup
 */
export function getBackupData(db) {
    try {
        return {
            version: "1.0.0",
            timestamp: new Date().toISOString(),
            uploads: db.prepare("SELECT * FROM ipfs_uploads").all(),
            achievements: db.prepare("SELECT * FROM achievement_cache").all(),
            metadata: {
                metrics: getDatabaseMetrics(db),
                integrity: checkDatabaseIntegrity(db),
                timestamp: new Date().toISOString(),
            },
        };
    } catch (err) {
        console.error("Error creating backup:", err);
        return null;
    }
}

/**
 * Clean up old mock uploads (older than 30 days)
 */
export function cleanupOldMockUploads(db, daysOld = 30) {
    try {
        const result = db.prepare(`
      DELETE FROM ipfs_uploads
      WHERE mocked = 1
      AND created_at < datetime('now', '-' || ? || ' days')
    `).run(daysOld);

        console.log(`[Database] Cleaned up ${result.changes} old mock uploads`);
        return result.changes;
    } catch (err) {
        console.error("Error cleaning up old uploads:", err);
        return 0;
    }
}
