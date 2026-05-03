import styles from "./About.module.css";

export function About() {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <h2 className={styles.title}>Hakkımızda</h2>

                <div className={styles.imageContainer}>
                    <div className={styles.badge}>since 2025</div>
                    <img
                        src="/team.jpg"
                        alt="ScholarPass Team"
                        className={styles.teamImage}
                    />
                </div>

                <div className={styles.description}>
                    <p>
                        ScholarPass, akademik başarıları blockchain teknolojisiyle doğrulanabilir
                        hale getiren innovative bir platformdur.
                    </p>

                    <p>
                        Stellar blockchain ve Soroban akıllı sözleşmeleri kullanarak, eğitim
                        kurumlarının verdiği sertifikaları ve başarıları güvenli, şeffaf ve
                        değiştirilemez bir şekilde kayıt altına alıyoruz.
                    </p>

                    <p>
                        Misyonumuz: Dijital kimlik ve eğitim kayıtlarını merkezi otoritelerden
                        kurtararak, bireylerin kendi başarılarının tam kontrolüne sahip olmalarını
                        sağlamak.
                    </p>

                    <div className={styles.features}>
                        <div className={styles.feature}>
                            <span className={styles.icon}>🔐</span>
                            <h3>Güvenli</h3>
                            <p>Stellar blockchain ile korunan, değiştirilemez kayıtlar</p>
                        </div>
                        <div className={styles.feature}>
                            <span className={styles.icon}>⚡</span>
                            <h3>Hızlı</h3>
                            <p>Soroban akıllı sözleşmeleriyle anında doğrulama</p>
                        </div>
                        <div className={styles.feature}>
                            <span className={styles.icon}>🌍</span>
                            <h3>Merkezi Olmayan</h3>
                            <p>İnsanlar kendi verilerine tam kontrol sahibi</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}