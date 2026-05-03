import { useEffect, useState, useCallback } from "react";
import { useFreighter } from "../hooks/useFreighter";
import { getAccountInfo, explorerLink, shortAddress } from "../lib/stellar";
import styles from "./WalletInfo.module.css";

interface AccountInfo {
  balance: string;
  sequence: string;
  subentryCount: number;
}

const REFRESH_INTERVAL = 30000; // 30 seconds

export function WalletInfo() {
  const { status, address, network } = useFreighter();
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAccountInfo = useCallback(async () => {
    if (!address || status !== "connected") {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getAccountInfo(address);
      setInfo(data);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bilgiler alınamadı";
      setError(message);
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [address, status]);

  // Initial fetch and periodic refresh
  useEffect(() => {
    if (status !== "connected" || !address) {
      setInfo(null);
      setError(null);
      setLastUpdated(null);
      return;
    }

    // Fetch immediately
    fetchAccountInfo();

    // Set up periodic refresh
    const interval = setInterval(fetchAccountInfo, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [status, address, fetchAccountInfo]);

  const handleRefresh = async () => {
    await fetchAccountInfo();
  };

  if (status !== "connected" || !address) return null;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.label}>Cüzdan Bilgileri</span>
        <div className={styles.headerActions}>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={loading}
            title="Yenile"
          >
            ↻
          </button>
          <a
            href={explorerLink(address)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.explorerLink}
          >
            Explorer'da Gör ↗
          </a>
        </div>
      </div>

      <div className={styles.addressRow}>
        <span className={styles.fieldLabel}>Adres</span>
        <span className={styles.address}>{shortAddress(address)}</span>
        <button
          className={styles.copyBtn}
          onClick={() => {
            navigator.clipboard.writeText(address);
            // Visual feedback
            const btn = event?.target as HTMLButtonElement;
            if (btn) {
              const original = btn.textContent;
              btn.textContent = "✓";
              setTimeout(() => {
                btn.textContent = original;
              }, 1500);
            }
          }}
          title="Kopyala"
        >
          ⧉
        </button>
      </div>

      {error && (
        <div className={styles.errorBox}>
          <span className={styles.errorIcon}>!</span>
          <span className={styles.errorText}>{error}</span>
          <button className={styles.retryBtn} onClick={handleRefresh}>
            Tekrar Dene
          </button>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.stat}>
          <span className={styles.fieldLabel}>XLM Bakiye</span>
          {loading && !info ? (
            <span className={styles.loading}>Yükleniyor...</span>
          ) : error && !info ? (
            <span className={styles.errorValue}>—</span>
          ) : (
            <span className={styles.balance}>
              {info ? parseFloat(info.balance).toFixed(4) : "—"}
              <span className={styles.unit}>XLM</span>
            </span>
          )}
        </div>

        <div className={styles.stat}>
          <span className={styles.fieldLabel}>Ağ</span>
          <span className={styles.networkBadge}>{network ?? "—"}</span>
        </div>

        <div className={styles.stat}>
          <span className={styles.fieldLabel}>Alt Kayıtlar</span>
          <span className={styles.value}>{info?.subentryCount ?? "—"}</span>
        </div>

        <div className={styles.stat}>
          <span className={styles.fieldLabel}>Sıra No</span>
          <span className={styles.value}>{info?.sequence ?? "—"}</span>
        </div>
      </div>

      {lastUpdated && (
        <div className={styles.footer}>
          <span className={styles.timestamp}>
            Son güncelleme: {lastUpdated.toLocaleTimeString("tr-TR")}
          </span>
        </div>
      )}
    </div>
  );
}
