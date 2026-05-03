/**
 * Database Stats Hook - Frontend IPFS & Database Statistics
 */

import { useState, useEffect, useCallback } from "react";

export interface DatabaseStats {
    uploads: {
        total: number;
        real: number;
        mock: number;
        totalSize: string;
        realSize: string;
    };
    achievements: {
        total: number;
        byCategory?: Record<string, number>;
        byIssuer?: Record<string, number>;
        recentWeek?: number;
    };
    database: {
        path: string;
        size: string;
        integrity: boolean;
    };
    timestamp: string;
}

export function useDatabaseStats() {
    const [stats, setStats] = useState<DatabaseStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/health");
            if (!response.ok) throw new Error("Failed to fetch health");

            const data = await response.json();
            setStats(data as DatabaseStats);
            setLastUpdate(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000); // Update every 30s
        return () => clearInterval(interval);
    }, [fetchStats]);

    return { stats, loading, error, lastUpdate, refetch: fetchStats };
}

/**
 * Fetch detailed admin statistics
 */
export async function fetchAdminStats() {
    try {
        const response = await fetch("/api/admin/stats");
        if (!response.ok) throw new Error("Failed to fetch admin stats");
        return await response.json();
    } catch (err) {
        console.error("Error fetching admin stats:", err);
        return null;
    }
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Get upload ratio visualization data
 */
export function getUploadRatio(stats: DatabaseStats | null) {
    if (!stats) return null;
    const { real, mock } = stats.uploads;
    const total = real + mock;
    return {
        real: total > 0 ? Math.round((real / total) * 100) : 0,
        mock: total > 0 ? Math.round((mock / total) * 100) : 0,
    };
}

/**
 * Get storage usage info
 */
export function getStorageInfo(stats: DatabaseStats | null) {
    if (!stats) return null;
    return {
        database: stats.database.size,
        uploads: {
            total: stats.uploads.totalSize,
            real: stats.uploads.realSize,
        },
    };
}

/**
 * Check if database is healthy
 */
export function isDatabaseHealthy(stats: DatabaseStats | null): boolean {
    return stats ? stats.database.integrity : false;
}
