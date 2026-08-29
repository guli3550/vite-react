export type EmptyStateProps = {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon = "💬",
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="proEmptyState">
      <span className="emptyIcon">{icon}</span>
      <h3 className="emptyTitle">{title}</h3>
      {description && <p className="emptyDesc">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="proPrimary emptyActionBtn" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function LoadingState({ text = "Ma'lumotlar yuklanmoqda..." }: { text?: string }) {
  return (
    <div className="proLoadingState">
      <div className="loadingSpinner" />
      <p>{text}</p>
    </div>
  );
}

export function ErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="proErrorAlert">
      <div className="errorAlertContent">
        <span className="errorIcon">⚠️</span>
        <div>
          <b>Xatolik yuz berdi</b>
          <p>{message}</p>
        </div>
      </div>
      {onRetry && (
        <button type="button" className="errorRetryBtn" onClick={onRetry}>
          Qayta urinish ↻
        </button>
      )}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  icon,
  tone = "",
  trend,
}: {
  label: string;
  value: string | number;
  icon: string;
  tone?: string;
  trend?: string;
}) {
  return (
    <div className={`metricCard ${tone}`}>
      <span className="metricIcon">{icon}</span>
      <div className="metricInfo">
        <small className="metricLabel">{label}</small>
        <strong className="metricValue">{value}</strong>
        {trend && <span className="metricTrend">{trend}</span>}
      </div>
    </div>
  );
}
