import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import { useFreighter } from "../hooks/useFreighter";
import {
  Achievement,
  addIssuer,
  getAchievements,
  isIssuer,
  issueAchievement,
  SCHOLARPASS_CONTRACT_ID,
} from "../lib/scholarpass";
import { uploadToIpfs } from "../lib/ipfs";
import {
  CachedAchievement,
  VerifyCertificateResult,
  getAchievementCache,
  saveAchievementCache,
  verifyCertificate,
} from "../lib/database";
import {
  RECORD_FEE_XLM,
  SERVICE_FEE_DESTINATION,
  isServiceFeeConfigured,
  payRecordFee,
  shortAddress,
} from "../lib/stellar";
import { useDatabaseStats } from "../hooks/useDatabaseStats";
import styles from "./ScholarPass.module.css";

type TxState = "idle" | "loading" | "signing" | "success" | "error";
type UploadState = "idle" | "uploading" | "ready" | "error";
type View = "issue" | "records" | "verify" | "admin";

const SCHOLARPASS_ADMIN_PUBLIC_KEY =
  import.meta.env.VITE_SCHOLARPASS_ADMIN_PUBLIC_KEY ?? "";

const initialForm = {
  student: "",
  title: "AI Destekli Mikro-Yetkinlik",
  category: "Yapay Zeka",
  issuerName: "ScholarPass Demo",
  cid: "bafy-scholarpass-demo",
};

function cleanPublicKey(value: string) {
  return value.trim().toUpperCase();
}

function isValidPublicKey(value: string) {
  return StrKey.isValidEd25519PublicKey(cleanPublicKey(value));
}

function cacheToAchievement(record: CachedAchievement): Achievement {
  return {
    id: record.chainId ?? record.id,
    student: record.student,
    issuer: record.issuer,
    title: record.title,
    category: record.category,
    issuerName: record.issuerName,
    cid: record.cid,
    issuedLedger: 0,
  };
}

function mergeAchievements(
  chainRecords: Achievement[],
  cachedRecords: CachedAchievement[]
) {
  const merged = new Map<string, Achievement>();

  chainRecords.forEach((record) => {
    merged.set(
      `${record.student}|${record.issuer}|${record.title}|${record.cid}`,
      record
    );
  });

  cachedRecords.map(cacheToAchievement).forEach((record) => {
    const key = `${record.student}|${record.issuer}|${record.title}|${record.cid}`;
    if (!merged.has(key)) merged.set(key, record);
  });

  return Array.from(merged.values()).sort((a, b) => b.id - a.id);
}

function readableSubmitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("issuer not authorized")) {
    return "Bu cüzdan henüz kurum yetkisine sahip değil. Kayıt yerel doğrulama modunda oluşturulabilir; zincire mühürleme için admin yetkisi gerekir.";
  }

  if (lower.includes("auth") || lower.includes("tx failed")) {
    return "İmza veya yetki kontrolü başarısız oldu. Admin olmayan cüzdanlar kurum yetkisi veremez.";
  }

  if (lower.includes("failed to fetch")) {
    return "Backend API'ye ulaşılamıyor. Projeyi kök dizinden npm run dev ile başlatın.";
  }

  return message || "İşlem tamamlanamadı";
}

export function ScholarPass() {
  const { status, address } = useFreighter();
  const { stats, error: statsError } = useDatabaseStats();
  const connected = status === "connected" && !!address;

  const [activeView, setActiveView] = useState<View>("issue");
  const [records, setRecords] = useState<Achievement[]>([]);
  const [issuer, setIssuer] = useState(false);
  const [lookupAddress, setLookupAddress] = useState("");
  const [form, setForm] = useState(initialForm);
  const [txState, setTxState] = useState<TxState>("idle");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [issuerCandidate, setIssuerCandidate] = useState("");
  const [verifyCid, setVerifyCid] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyCertificateResult | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [feePaymentCompleted, setFeePaymentCompleted] = useState(false);
  const [feeTransactionHash, setFeeTransactionHash] = useState<string | null>(null);

  const cleanedLookupAddress = useMemo(
    () => cleanPublicKey(lookupAddress),
    [lookupAddress]
  );
  const cleanedStudentAddress = useMemo(
    () => cleanPublicKey(form.student),
    [form.student]
  );
  const cleanedIssuerCandidate = useMemo(
    () => cleanPublicKey(issuerCandidate),
    [issuerCandidate]
  );
  const cleanedAdminAddress = cleanPublicKey(SCHOLARPASS_ADMIN_PUBLIC_KEY);
  const isAdminWallet =
    connected &&
    !!cleanedAdminAddress &&
    cleanPublicKey(address) === cleanedAdminAddress;

  const canRefresh = connected && isValidPublicKey(lookupAddress);
  const canAuthorizeIssuer = isAdminWallet && isValidPublicKey(issuerCandidate);
  const serviceFeeConfigured = isServiceFeeConfigured();

  const canSubmit = useMemo(() => {
    return (
      connected &&
      serviceFeeConfigured &&
      isValidPublicKey(form.student) &&
      form.title.trim().length > 0 &&
      form.category.trim().length > 0 &&
      form.issuerName.trim().length > 0 &&
      form.cid.trim().length > 0
    );
  }, [connected, serviceFeeConfigured, form]);

  const canPayFee = canSubmit && !feePaymentCompleted;
  const canCreateRecord = canSubmit && feePaymentCompleted && !!feeTransactionHash;

  const submitHint = useMemo(() => {
    if (!connected) return "Başlamak için cüzdan bağlayın";
    if (!serviceFeeConfigured) {
      return "Kayıt ücreti tahsilat cüzdanı yapılandırılmalı";
    }
    if (!isValidPublicKey(form.student)) return "Geçerli bir öğrenci public key girin";
    if (!form.title.trim()) return "Başlık girin";
    if (!form.category.trim()) return "Kategori girin";
    if (!form.issuerName.trim()) return "Veren kurum veya kulüp girin";
    if (!form.cid.trim()) return "Belge yükleyin veya IPFS CID girin";
    if (!feePaymentCompleted) {
      return `Adım 1/2: ${RECORD_FEE_XLM} XLM kayıt ücretini ödeyin (Freighter'da onayla)`;
    }
    return issuer
      ? `Adım 2/2: Zincire mühürle (${RECORD_FEE_XLM} XLM ödeme tamamlandı)`
      : `Adım 2/2: Doğrulama kaydı oluştur (${RECORD_FEE_XLM} XLM ödeme tamamlandı)`;
  }, [connected, issuer, serviceFeeConfigured, form, feePaymentCompleted]);

  const refresh = useCallback(
    async (target = lookupAddress) => {
      const targetAddress = cleanPublicKey(target);
      if (!connected || !address || !SCHOLARPASS_CONTRACT_ID || !targetAddress) return;
      if (!isValidPublicKey(targetAddress)) {
        setMessage("Geçerli bir öğrenci Stellar adresi girin");
        setTxState("error");
        return;
      }

      setTxState("loading");
      setMessage(null);
      setLookupAddress(targetAddress);

      const [chainResult, cacheResult, issuerResult] = await Promise.allSettled([
        getAchievements(address, targetAddress),
        getAchievementCache(targetAddress),
        isIssuer(address, address),
      ]);

      const chainRecords =
        chainResult.status === "fulfilled" ? chainResult.value : [];
      const cachedRecords =
        cacheResult.status === "fulfilled" ? cacheResult.value : [];

      setRecords(mergeAchievements(chainRecords, cachedRecords));

      if (issuerResult.status === "fulfilled") {
        setIssuer(issuerResult.value);
      } else {
        setIssuer(false);
      }

      if (chainResult.status === "rejected" && cachedRecords.length > 0) {
        setMessage("Zincir kayıtları okunamadı; doğrulanabilir yerel kayıtlar gösteriliyor.");
        setTxState("error");
        return;
      }

      if (chainResult.status === "rejected" && cacheResult.status === "rejected") {
        setMessage(readableSubmitError(chainResult.reason));
        setTxState("error");
        return;
      }

      setTxState("idle");
    },
    [address, connected, lookupAddress]
  );

  useEffect(() => {
    const scrollToAction = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === "certificates") setActiveView("records");
      if (action === "new") setActiveView("issue");
      if (action === "verify") setActiveView("verify");
      document.getElementById("scholarpass-workspace")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };

    window.addEventListener("scholarpass:navigate", scrollToAction);
    return () => window.removeEventListener("scholarpass:navigate", scrollToAction);
  }, []);

  useEffect(() => {
    if (!address) return;
    setLookupAddress(address);
    setForm((current) => ({ ...current, student: address }));
    setIssuerCandidate(address);
  }, [address]);

  useEffect(() => {
    if (!connected || !address) return;
    void refresh(address);
  }, [address, connected]);

  if (!SCHOLARPASS_CONTRACT_ID) {
    return (
      <section className={styles.workspace}>
        <div className={styles.emptyState}>
          <strong>Kontrat ayarı eksik</strong>
          <span>ScholarPass kontrat ID bulunamadı.</span>
        </div>
      </section>
    );
  }

  const handlePayFee = async (event: FormEvent) => {
    event.preventDefault();
    if (!canPayFee || !address) {
      setMessage("Ödeme form tamamlanmadı");
      setTxState("error");
      return;
    }

    setTxState("signing");
    setMessage(null);
    try {
      setMessage(`Adım 1/2: Freighter'da ${RECORD_FEE_XLM} XLM ödemesini onayla...`);
      const feeTxHash = await payRecordFee(address);

      setFeePaymentCompleted(true);
      setFeeTransactionHash(feeTxHash);
      setTxState("idle");
      setMessage(`✓ Ödeme başarıyla gerçekleşti. Hash: ${feeTxHash.slice(0, 16)}...`);
    } catch (err) {
      setMessage(readableSubmitError(err));
      setTxState("error");
    }
  };

  const handleCreateRecord = async (event: FormEvent) => {
    event.preventDefault();
    if (!canCreateRecord || !address || !feeTransactionHash) {
      setMessage("Kayıt oluşturma tamamlanamadı - Lütfen önce ödemeyi yapın");
      setTxState("error");
      return;
    }

    const payload = {
      student: cleanedStudentAddress,
      title: form.title.trim(),
      category: form.category.trim(),
      issuerName: form.issuerName.trim(),
      cid: form.cid.trim(),
    };

    setTxState("signing");
    setMessage(null);
    try {
      setMessage("Adım 2/2: Kayıt oluşturuluyor...");

      const id = issuer ? await issueAchievement(address, payload) : Date.now();

      await saveAchievementCache({
        chainId: id,
        student: payload.student,
        issuer: cleanPublicKey(address),
        title: payload.title,
        category: payload.category,
        issuerName: payload.issuerName,
        cid: payload.cid,
        txHash: feeTransactionHash,
      });

      setTxState("success");
      setMessage(
        issuer
          ? `✓ Kayıt zincire mühürlendi. Ödeme: ${feeTransactionHash.slice(0, 16)}...`
          : `✓ Kayıt oluşturuldu. Ödeme: ${feeTransactionHash.slice(0, 16)}...`
      );

      // Form sıfırla
      setForm(initialForm);
      setSelectedFile(null);
      setUploadState("idle");
      setFeePaymentCompleted(false);
      setFeeTransactionHash(null);

      setLookupAddress(payload.student);
      setActiveView("records");
      await refresh(payload.student);
    } catch (err) {
      setMessage(readableSubmitError(err));
      setTxState("error");
    }
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;

    setSelectedFile(file.name);
    setUploadState("uploading");
    setMessage(null);
    try {
      const result = await uploadToIpfs(file);
      setForm((current) => ({ ...current, cid: result.cid }));
      setUploadState("ready");
      setMessage(
        result.mocked
          ? "Belge geliştirme modunda kaydedildi. CID form alanına eklendi."
          : "Belge IPFS'e yüklendi. CID form alanına eklendi."
      );
    } catch (err) {
      setUploadState("error");
      setMessage(readableSubmitError(err));
      setTxState("error");
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setSelectedFile(null);
    setUploadState("idle");
    setFeePaymentCompleted(false);
    setFeeTransactionHash(null);
    setMessage(null);
    setTxState("idle");
  };

  const handleAuthorizeIssuer = async () => {
    if (!SCHOLARPASS_ADMIN_PUBLIC_KEY) {
      setMessage("Admin cüzdan tanımlı olmadığı için yetki işlemi kapalı.");
      setTxState("error");
      return;
    }

    if (!isAdminWallet) {
      setMessage("Bu işlem yalnızca kontrat admin cüzdanıyla yapılabilir.");
      setTxState("error");
      return;
    }

    if (!canAuthorizeIssuer) {
      setMessage("Yetki verilecek geçerli bir issuer public key girin");
      setTxState("error");
      return;
    }

    setTxState("signing");
    setMessage(null);
    try {
      await addIssuer(address!, cleanedIssuerCandidate);
      setMessage("Issuer yetkisi başarıyla verildi.");
      setTxState("success");
      if (cleanedIssuerCandidate === cleanPublicKey(address!)) {
        setIssuer(true);
      }
    } catch (err) {
      setMessage(readableSubmitError(err));
      setTxState("error");
    }
  };

  const handleVerify = async () => {
    const cid = verifyCid.trim() || form.cid.trim();
    if (!cid) {
      setVerifyMessage("Doğrulamak için IPFS CID girin");
      setVerifyResult(null);
      return;
    }

    setVerifyMessage("Doğrulanıyor...");
    setVerifyResult(null);
    try {
      const result = await verifyCertificate(cid);
      setVerifyResult(result);
      setVerifyMessage(
        result.relatedCount > 0
          ? "Sertifika kaydı doğrulandı"
          : "Dosya bulundu, ancak henüz bir öğrenci kaydına bağlı değil"
      );
    } catch (err) {
      setVerifyMessage(readableSubmitError(err));
    }
  };

  const busy = txState === "loading" || txState === "signing";
  const roleLabel = issuer ? "Kurum yetkili" : isAdminWallet ? "Admin" : "Standart cüzdan";
  const healthLabel = stats?.database.integrity
    ? "API sağlıklı"
    : statsError
      ? "API kontrol edilemiyor"
      : "API kontrol ediliyor";

  return (
    <section className={styles.workspace} id="scholarpass-workspace">
      <div className={styles.topBar}>
        <div>
          <span className={styles.eyebrow}>ScholarPass Paneli</span>
          <h2>Belge yönetimi</h2>
        </div>
        <div className={styles.statusGrid}>
          <span className={stats?.database.integrity ? styles.goodPill : styles.neutralPill}>
            {healthLabel}
          </span>
          <span className={issuer ? styles.goodPill : styles.neutralPill}>{roleLabel}</span>
          <span className={styles.neutralPill} title={SCHOLARPASS_CONTRACT_ID}>
            {shortAddress(SCHOLARPASS_CONTRACT_ID)}
          </span>
          <span
            className={serviceFeeConfigured ? styles.goodPill : styles.warningPill}
            title={SERVICE_FEE_DESTINATION || "Tahsilat cüzdanı yok"}
          >
            {serviceFeeConfigured ? `${RECORD_FEE_XLM} XLM ücret` : "Ücret ayarı eksik"}
          </span>
        </div>
      </div>

      {!connected ? (
        <div className={styles.emptyState}>
          <strong>Cüzdan bağlantısı bekleniyor</strong>
          <span>Belge yükleme, kayıt oluşturma ve doğrulama için önce Freighter cüzdanınızı bağlayın.</span>
        </div>
      ) : (
        <>
          <div className={styles.tabs} role="tablist" aria-label="ScholarPass işlemleri">
            <button
              type="button"
              className={activeView === "issue" ? styles.activeTab : styles.tab}
              onClick={() => setActiveView("issue")}
            >
              Kayıt Oluştur
            </button>
            <button
              type="button"
              className={activeView === "records" ? styles.activeTab : styles.tab}
              onClick={() => setActiveView("records")}
            >
              Kayıtlar
            </button>
            <button
              type="button"
              className={activeView === "verify" ? styles.activeTab : styles.tab}
              onClick={() => setActiveView("verify")}
            >
              Doğrula
            </button>
            {SCHOLARPASS_ADMIN_PUBLIC_KEY && (
              <button
                type="button"
                className={activeView === "admin" ? styles.activeTab : styles.tab}
                onClick={() => setActiveView("admin")}
              >
                Yönetim
              </button>
            )}
          </div>

          {activeView === "issue" && (
            <div className={styles.layout}>
              <div className={styles.formPanel}>
                <div className={styles.panelHeader}>
                  <div>
                    <span className={styles.eyebrow}>Yeni kayıt</span>
                    <h3>{issuer ? "Zincire mühürle" : "Doğrulama kaydı oluştur"}</h3>
                  </div>
                  <span className={issuer ? styles.goodPill : styles.warningPill}>
                    {issuer ? "Ücret + blockchain" : "Ücret + doğrulama"}
                  </span>
                </div>

                <div className={styles.dropzone}>
                  <input
                    id="certificateFile"
                    type="file"
                    accept="image/*,.pdf,.json,.xml,.csv,.txt,.zip,.gz"
                    onChange={(event) => handleFileUpload(event.target.files?.[0] ?? null)}
                    disabled={uploadState === "uploading" || txState === "signing"}
                  />
                  <label htmlFor="certificateFile">
                    <span>Belge</span>
                    <strong>{selectedFile ?? "Dosya seçin"}</strong>
                    <small>
                      {uploadState === "uploading"
                        ? "IPFS'e yükleniyor..."
                        : uploadState === "ready"
                          ? "CID hazır"
                          : uploadState === "error"
                            ? "Yükleme başarısız"
                            : "PDF, görsel, JSON veya metin dosyası"}
                    </small>
                  </label>
                </div>

                <div className={styles.twoColumn}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="student">Öğrenci public key</label>
                    <input
                      id="student"
                      className={styles.input}
                      value={form.student}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, student: event.target.value }))
                      }
                      onBlur={() =>
                        setForm((current) => ({ ...current, student: cleanedStudentAddress }))
                      }
                      disabled={txState === "signing"}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="category">Kategori</label>
                    <input
                      id="category"
                      className={styles.input}
                      value={form.category}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, category: event.target.value }))
                      }
                      disabled={txState === "signing"}
                    />
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="title">Başlık</label>
                  <input
                    id="title"
                    className={styles.input}
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                    disabled={txState === "signing"}
                  />
                </div>

                <div className={styles.twoColumn}>
                  <div className={styles.fieldGroup}>
                    <label htmlFor="issuerName">Veren kurum veya kulüp</label>
                    <input
                      id="issuerName"
                      className={styles.input}
                      value={form.issuerName}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, issuerName: event.target.value }))
                      }
                      disabled={txState === "signing"}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="cid">IPFS CID</label>
                    <input
                      id="cid"
                      className={styles.input}
                      value={form.cid}
                      placeholder="Dosya yüklenince otomatik dolar"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, cid: event.target.value }))
                      }
                      disabled={txState === "signing"}
                    />
                  </div>
                </div>

                <div className={styles.actions}>
                  {!feePaymentCompleted ? (
                    <>
                      <button
                        className={styles.button}
                        type="button"
                        disabled={!canPayFee || txState === "signing"}
                        onClick={handlePayFee}
                        title={submitHint ?? undefined}
                      >
                        {txState === "signing"
                          ? "Freighter'da imzala..."
                          : `Adım 1: ${RECORD_FEE_XLM} XLM Öde`}
                      </button>
                      <button
                        className={styles.secondaryButton}
                        type="button"
                        disabled={false}
                        onClick={resetForm}
                      >
                        Formu Sıfırla
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={styles.button}
                        type="button"
                        disabled={!canCreateRecord || txState === "signing"}
                        onClick={handleCreateRecord}
                      >
                        {txState === "signing"
                          ? issuer
                            ? "Zincire yazılıyor..."
                            : "Kaydediliyor..."
                          : issuer
                            ? "Adım 2: Zincire Mühürle"
                            : "Adım 2: Kaydı Oluştur"}
                      </button>
                      <button
                        className={styles.secondaryButton}
                        type="button"
                        disabled={txState === "signing"}
                        onClick={resetForm}
                      >
                        Baştan Başla
                      </button>
                    </>
                  )}
                </div>
                <div className={styles.hint}>{submitHint}</div>
              </div>

              <aside className={styles.sidePanel}>
                <span className={styles.eyebrow}>Durum</span>
                <div className={styles.stepList}>
                  <div className={selectedFile ? styles.doneStep : styles.step}>
                    <strong>1. Belge</strong>
                    <span>{selectedFile ? selectedFile : "Dosya veya hazır CID bekleniyor"}</span>
                  </div>
                  <div className={form.cid.trim() ? styles.doneStep : styles.step}>
                    <strong>2. CID</strong>
                    <span>{form.cid.trim() ? shortAddress(form.cid.trim()) : "Henüz yok"}</span>
                  </div>
                  <div className={feePaymentCompleted ? styles.doneStep : styles.step}>
                    <strong>3. Ödeme</strong>
                    <span>
                      {feePaymentCompleted && feeTransactionHash
                        ? `✓ ${RECORD_FEE_XLM} XLM ödendi`
                        : `${RECORD_FEE_XLM} XLM gerekli`}
                    </span>
                  </div>
                  <div className={feePaymentCompleted ? styles.doneStep : styles.step}>
                    <strong>4. Kayıt Tipi</strong>
                    <span>
                      {issuer
                        ? "Zincire yazabilir"
                        : "Yerel doğrulama kaydı oluşturur"}
                    </span>
                  </div>
                </div>
                {message && (
                  <div className={`${styles.status} ${txState === "error" ? styles.error : ""}`}>
                    {message}
                  </div>
                )}
              </aside>
            </div>
          )}

          {activeView === "records" && (
            <div className={styles.formPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.eyebrow}>Öğrenci kayıtları</span>
                  <h3>{records.length} doğrulama kaydı</h3>
                </div>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  disabled={busy || !canRefresh}
                  onClick={() => refresh()}
                >
                  Yenile
                </button>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="lookup">Öğrenci adresi</label>
                <input
                  id="lookup"
                  className={styles.input}
                  value={lookupAddress}
                  onChange={(event) => setLookupAddress(event.target.value)}
                  onBlur={() => setLookupAddress(cleanedLookupAddress)}
                />
              </div>

              <RecordList records={records} />
            </div>
          )}

          {activeView === "verify" && (
            <div className={styles.formPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.eyebrow}>Sertifika doğrulama</span>
                  <h3>CID ile kontrol et</h3>
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="verifyCid">IPFS CID</label>
                <input
                  id="verifyCid"
                  className={styles.input}
                  value={verifyCid}
                  placeholder={form.cid || "bafy..."}
                  onChange={(event) => setVerifyCid(event.target.value)}
                />
              </div>
              <button className={styles.button} type="button" onClick={handleVerify}>
                Doğrula
              </button>
              {verifyMessage && (
                <div className={`${styles.status} ${verifyResult ? "" : styles.neutralStatus}`}>
                  {verifyMessage}
                </div>
              )}
              {verifyResult && <VerifyResult result={verifyResult} />}
            </div>
          )}

          {activeView === "admin" && (
            <div className={styles.formPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.eyebrow}>Yetki yönetimi</span>
                  <h3>Issuer tanımla</h3>
                </div>
                <span className={isAdminWallet ? styles.goodPill : styles.warningPill}>
                  {isAdminWallet ? "Admin aktif" : "Admin değil"}
                </span>
              </div>

              <div className={styles.notice}>
                <strong>Admin koruması aktif</strong>
                <p>
                  Yetki verme işlemi yalnızca kontrat admin cüzdanıyla gönderilir.
                  Diğer cüzdanlarda transaction başlatılmaz.
                </p>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="issuerCandidate">Yetki verilecek issuer public key</label>
                <input
                  id="issuerCandidate"
                  className={styles.input}
                  value={issuerCandidate}
                  onChange={(event) => setIssuerCandidate(event.target.value)}
                  onBlur={() => setIssuerCandidate(cleanedIssuerCandidate)}
                />
              </div>

              <button
                className={styles.button}
                type="button"
                disabled={!canAuthorizeIssuer || busy}
                onClick={handleAuthorizeIssuer}
                title={
                  !SCHOLARPASS_ADMIN_PUBLIC_KEY
                    ? "Admin adresi yapılandırılmadı"
                    : !isAdminWallet
                      ? "Bu cüzdan kontrat admin'i değil"
                      : undefined
                }
              >
                Issuer Yetkisi Ver
              </button>

              {!SCHOLARPASS_ADMIN_PUBLIC_KEY && (
                <div className={styles.hint}>
                  Admin işlemlerini açmak için frontend ortamında
                  VITE_SCHOLARPASS_ADMIN_PUBLIC_KEY tanımlanmalı.
                </div>
              )}

              {message && (
                <div className={`${styles.status} ${txState === "error" ? styles.error : ""}`}>
                  {message}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RecordList({ records }: { records: Achievement[] }) {
  if (records.length === 0) {
    return (
      <div className={styles.emptyState}>
        <strong>Henüz kayıt yok</strong>
        <span>Bu öğrenci için oluşturulan doğrulama kayıtları burada görünür.</span>
      </div>
    );
  }

  return (
    <div className={styles.records}>
      {records.map((record) => (
        <article className={styles.record} key={`${record.student}-${record.id}-${record.cid}`}>
          <div className={styles.recordTitle}>{record.title}</div>
          <div className={styles.recordMeta}>
            <span>#{record.id}</span>
            <span>{record.category}</span>
            <span>{record.issuerName}</span>
            <span>{record.issuedLedger > 0 ? `ledger ${record.issuedLedger}` : "yerel kayıt"}</span>
          </div>
          <div className={styles.cid}>{record.cid}</div>
          <a
            className={styles.ipfsLink}
            href={`https://ipfs.io/ipfs/${record.cid}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            IPFS belgesini aç
          </a>
        </article>
      ))}
    </div>
  );
}

function VerifyResult({ result }: { result: VerifyCertificateResult }) {
  return (
    <div className={styles.records}>
      <article className={styles.record}>
        <div className={styles.recordTitle}>
          {result.relatedCount > 0 ? "Kayıtlı sertifika" : "IPFS dosyası bulundu"}
        </div>
        <div className={styles.recordMeta}>
          <span>{result.upload.filename}</span>
          <span>{(result.upload.size / 1024).toFixed(2)}KB</span>
          <span>{result.upload.mocked ? "demo" : "pinata"}</span>
        </div>
        <div className={styles.cid}>{result.upload.cid}</div>
        {result.achievements.map((achievement) => (
          <div className={styles.verifyRecord} key={achievement.id}>
            <strong>{achievement.title}</strong>
            <span>{achievement.student}</span>
          </div>
        ))}
      </article>
    </div>
  );
}
