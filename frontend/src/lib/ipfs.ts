export interface IpfsUploadResult {
  cid: string;
  filename: string;
  size: number;
  gatewayUrl: string;
  mocked: boolean;
}

export interface IpfsUploadError {
  code: string;
  message: string;
  details?: string;
}

const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
  "application/zip",
  "application/gzip",
];

const MAX_FILE_SIZE = 12 * 1024 * 1024; // 12MB

export function validateFile(file: File): IpfsUploadError | null {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      code: "FILE_TOO_LARGE",
      message: `Dosya çok büyük. Maksimum boyut: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`,
    };
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      code: "INVALID_FILE_TYPE",
      message: `Dosya tipi desteklenmiyor: ${file.type || "bilinmiyor"}`,
      details: `İzin verilen tipler: ${ALLOWED_FILE_TYPES.join(", ")}`,
    };
  }

  return null;
}

export async function uploadToIpfs(file: File): Promise<IpfsUploadResult> {
  // Validate file
  const validationError = validateFile(file);
  if (validationError) {
    throw new Error(validationError.message);
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/ipfs/upload", {
      method: "POST",
      body: formData,
    });

    const payload = await response.json();

    if (!response.ok) {
      const errorMsg = payload?.error ?? "IPFS yukleme basarisiz";
      throw new Error(errorMsg);
    }

    if (!payload.cid) {
      throw new Error("Sunucudan geçersiz CID alındı");
    }

    return payload as IpfsUploadResult;
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Failed to fetch") {
        throw new Error(
          "Backend API'ye ulaşılamıyor. Projeyi kök dizinden `npm run dev` ile başlatın."
        );
      }
      throw err;
    }
    throw new Error("IPFS bağlantı hatası");
  }
}
