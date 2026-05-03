/**
 * IPFS Utilities - Helper functions for IPFS operations
 */

export const IPFS_GATEWAY = "https://ipfs.io/ipfs";
export const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs";

export interface IpfsFile {
    cid: string;
    filename: string;
    size: number;
    gatewayUrl: string;
    mocked: boolean;
    createdAt?: string;
}

export interface IpfsStats {
    total: number;
    real: number;
    mock: number;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Format CID to shorter display format
 */
export function formatCid(cid: string, length: number = 16): string {
    if (cid.length <= length) return cid;
    return cid.slice(0, length) + "...";
}

/**
 * Check if CID is valid (basic validation)
 */
export function isValidCid(cid: string): boolean {
    // Simple validation - IPFS CIDs usually start with Qm or bafy
    return /^(Qm|bafy)[a-zA-Z0-9]{40,}$/.test(cid);
}

/**
 * Get IPFS gateway URL for a CID
 */
export function getIpfsUrl(cid: string, gateway: "ipfs" | "pinata" = "ipfs"): string {
    if (!isValidCid(cid)) {
        throw new Error("Invalid CID format");
    }
    const baseUrl = gateway === "pinata" ? PINATA_GATEWAY : IPFS_GATEWAY;
    return `${baseUrl}/${cid}`;
}

/**
 * Fetch IPFS file stats from backend
 */
export async function fetchIpfsStats(): Promise<IpfsStats> {
    try {
        const response = await fetch("/api/health");
        if (!response.ok) throw new Error("Health check failed");

        const data = await response.json();
        return data.database?.uploads ?? { total: 0, real: 0, mock: 0 };
    } catch (err) {
        console.error("Failed to fetch IPFS stats:", err);
        return { total: 0, real: 0, mock: 0 };
    }
}

/**
 * Fetch list of uploaded files
 */
export async function fetchIpfsUploads(
    limit: number = 50,
    offset: number = 0,
    filterMocked?: boolean
): Promise<{ uploads: IpfsFile[]; total: number }> {
    try {
        let url = `/api/ipfs/uploads?limit=${limit}&offset=${offset}`;
        if (filterMocked !== undefined) {
            url += `&mocked=${filterMocked}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch uploads");

        const data = await response.json();
        return {
            uploads: data.uploads || [],
            total: data.pagination?.total ?? 0,
        };
    } catch (err) {
        console.error("Failed to fetch IPFS uploads:", err);
        return { uploads: [], total: 0 };
    }
}

/**
 * Generate metadata for IPFS file
 */
export function generateFileMetadata(
    filename: string,
    size: number,
    additionalData?: Record<string, string>
) {
    return {
        name: filename,
        size,
        uploadedAt: new Date().toISOString(),
        ...additionalData,
    };
}

/**
 * Verify CID matches expected format for file
 */
export function verifyCidFormat(cid: string, expectedPrefix?: "Qm" | "bafy"): boolean {
    if (!isValidCid(cid)) return false;
    if (expectedPrefix && !cid.startsWith(expectedPrefix)) return false;
    return true;
}
