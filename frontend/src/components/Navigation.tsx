import styles from "./Navigation.module.css";

export function Navigation() {
    return (
        <nav className={styles.nav}>
            <div className={styles.navInner}>
                <div className={styles.navLeft}>
                    <div className={styles.miniStarIcon}></div>
                </div>

                <ul className={styles.navLinks}>
                    <li>
                        <a href="#" className={styles.navLink}>
                            Sertifikalar
                        </a>
                    </li>
                </ul>
            </div>
        </nav>
    );
}