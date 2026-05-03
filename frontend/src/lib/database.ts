import { SCHOLARPASS_CONTRACT_ID } from "./scholarpass";

export interface SaveAchievementInput {
  chainId: number;
  student: string;
  issuer: string;
  title: string;
  category: string;
  issuerName: string;
  cid: string;
  txHash?: string | null;
}

export interface CachedAchievement {
  id: number;
  contractId: string;
  chainId: number | null;
  student: string;
  issuer: string;
  title: string;
  category: string;
  issuerName: string;
  cid: string;
  txHash: string | null;
  createdAt: string;
}

export async function saveAchievementCache(input: SaveAchievementInput) {
  const response = await apiFetch("/api/achievements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractId: SCHOLARPASS_CONTRACT_ID,
      ...input,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error ?? "Veritabani kaydi olusturulamadi");
  }

  return response.json();
}

export async function getAchievementCache(student: string): Promise<CachedAchievement[]> {
  const response = await apiFetch(`/api/achievements/${encodeURIComponent(student)}`);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error ?? "Kayit cache'i okunamadi");
  }

  const payload = await response.json();
  return Array.isArray(payload?.achievements) ? payload.achievements : [];
}

export interface VerifyCertificateResult {
  upload: {
    cid: string;
    filename: string;
    size: number;
    gateway_url?: string;
    gatewayUrl?: string;
    mocked: boolean;
    created_at?: string;
  };
  achievements: CachedAchievement[];
  relatedCount: number;
}

export async function verifyCertificate(cid: string): Promise<VerifyCertificateResult> {
  const response = await apiFetch(`/api/ipfs/${encodeURIComponent(cid.trim())}`);

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error ?? "Sertifika dogrulanamadi");
  }

  return response.json();
}

async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (err instanceof Error && err.message === "Failed to fetch") {
      throw new Error(
        "Backend API'ye ulaşılamıyor. Projeyi kök dizinden `npm run dev` ile başlatın."
      );
    }
    throw err;
  }
}
