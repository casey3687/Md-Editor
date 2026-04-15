import styles from "./WelcomeView.module.css";

type WelcomeViewProps = {
  onOpenFolder: () => void;
  onOpenFile: () => void;
};

export function WelcomeView({ onOpenFolder, onOpenFile }: WelcomeViewProps) {
  return (
    <section className={styles.welcome}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Local-first Markdown workspace</p>
        <h1 className={styles.title}>Markdown Editor</h1>
        <p className={styles.description}>
          Open a folder to browse your notes, or open a single .md file to start editing right away.
        </p>
        <div className={styles.actions}>
          <button type="button" aria-label="Open Folder" onClick={onOpenFolder} className={styles.primaryButton}>
            打开文件夹
          </button>
          <button type="button" aria-label="Open File" onClick={onOpenFile} className={styles.secondaryButton}>
            打开文件
          </button>
        </div>
      </div>
    </section>
  );
}
