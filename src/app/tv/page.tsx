import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { ManilaClock } from "./manila-clock";
import styles from "./tv.module.css";

export const metadata: Metadata = { title: `${APP_NAME} · TV` };

// Week 1 layout for the gym TV. The rotating QR arrives in week 3 and the
// live welcome banner, counts and top streaks in week 5.
export default function TvPage() {
  return (
    <main className={styles.tv}>
      <section className={styles.qrPanel}>
        <div className={styles.qrBox} aria-label="Check-in code placeholder">
          <span>QR code</span>
          <small>arrives in week 3</small>
        </div>
        <p className={styles.scanHint}>Open the app and tap Scan to check in</p>
      </section>

      <section className={styles.side}>
        <ManilaClock className={styles.clock} />
        <div className={styles.panel}>
          <p className={styles.label}>Today</p>
          <p className={styles.big}>0</p>
          <p className={styles.label}>check-ins</p>
        </div>
        <div className={styles.panel}>
          <p className={styles.label}>Monthly visits goal</p>
          <div className="bar" style={{ height: 18 }}>
            <div style={{ width: "0%" }} />
          </div>
        </div>
        <div className={styles.panel}>
          <p className={styles.label}>Top streaks</p>
          <p className="muted">Shown here from week 5 (opted-in members only)</p>
        </div>
      </section>
    </main>
  );
}
