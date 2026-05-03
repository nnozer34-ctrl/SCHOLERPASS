import { useFreighter } from "./hooks/useFreighter";
import { Navigation } from "./components/Navigation";
import { ConnectButton } from "./components/ConnectButton";
import { WalletInfo } from "./components/WalletInfo";
import { ScholarPass } from "./components/ScholarPass";
import styles from "./App.module.css";

export default function App() {
  const { error } = useFreighter();

  return (
    <div className={styles.root}>
      <Navigation />

      <header className={styles.header}>
        <div className={styles.logo}>
          <ScholarPassLogo />
          <span>ScholarPass</span>
        </div>
        <ConnectButton />
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>
            ScholarPass çalışma alanı
          </h1>
          <p className={styles.subtitle}>
            Belge yükleyin, öğrenci kaydı oluşturun ve IPFS CID ile
            doğrulamayı tek ekrandan yönetin.
          </p>

          {error && (
            <div className={styles.errorBanner}>
              <span>!</span> {error}
            </div>
          )}
        </div>

        <WalletInfo />
        <ScholarPass />
      </main>

      <footer className={styles.footer}>
        <span>Testnet üzerinde çalışıyor</span>
        <span className={styles.dot}>·</span>
        <span>Stellar + Soroban</span>
      </footer>
    </div>
  );
}

function ScholarPassLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
      <rect width="34" height="34" rx="8" fill="#05030A" />
      <rect
        x="1"
        y="1"
        width="32"
        height="32"
        rx="7"
        stroke="#9B5CFF"
        strokeOpacity="0.8"
        strokeWidth="1.5"
      />
      <path
        d="M10 21.5V15M14 22.5V8.5M18 22.5V16.5M22 21.5V8.5M10 15C8.5 15.8 7.8 17.3 8.2 19.1L9 22.6C9.5 25 11.6 26.5 14 26.5H20.1C22.9 26.5 25 24.3 25 21.5V14.2C25 13.3 24.3 12.6 23.4 12.6C22.6 12.6 22 13.3 22 14.1V8.5C22 7.6 21.3 6.9 20.4 6.9C19.5 6.9 18.8 7.6 18.8 8.5V16.5M14 8.5C14 7.6 14.7 6.9 15.6 6.9C16.5 6.9 17.2 7.6 17.2 8.5V16.5M10 15V11.5C10 10.6 10.7 9.9 11.6 9.9C12.5 9.9 13.2 10.6 13.2 11.5V22.5"
        fill="none"
        stroke="#B78CFF"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7.5 27.5L26.5 6.5" stroke="white" strokeOpacity="0.2" />
    </svg>
  );
}
