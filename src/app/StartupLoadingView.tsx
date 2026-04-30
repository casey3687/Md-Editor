import styles from "./StartupLoadingView.module.css";

type StartupLoadingViewProps = {
  showMessage?: boolean;
};

export function StartupLoadingView({ showMessage = false }: StartupLoadingViewProps) {
  return (
    <section className={styles.loadingView} aria-busy="true">
      {showMessage ? (
        <p role="status" aria-label="正在加载中" className={styles.message}>
          正在加载中......
        </p>
      ) : null}
    </section>
  );
}
