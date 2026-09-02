export type EmptyStateProps = {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

// The Orders table lives in AdminPro.tsx. Keep the avatar bridge here so the
// existing customer-photo endpoint is reused without duplicating API logic in
// the large admin page component.
function installOrdersAvatarBridge() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const key = "__guliOrdersAvatarBridgeInstalled";
  if ((window as any)[key]) return;
  (window as any)[key] = true;

  const enhance = () => {
    const token = sessionStorage.getItem("guli_admin_token") || "";
    const base = (sessionStorage.getItem("guli_custom_api_url") || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
    if (!token) return;

    document.querySelectorAll("table").forEach((table) => {
      const headers = Array.from(table.querySelectorAll("thead th")).map((th) =>
        (th.textContent || "").trim()
      );
      const isOrdersTable = headers[0] === "Kod" && headers[1] === "№" && headers[2] === "Mijoz";
      if (!isOrdersTable) return;

      table.querySelectorAll("tbody tr").forEach((row) => {
        const cells = row.querySelectorAll("td");
        const customerCell = cells[2];
        const orderNumber = (cells[1]?.textContent || "").trim();
        if (!customerCell || !orderNumber || customerCell.dataset.guliAvatarLoaded === "1") return;
        customerCell.dataset.guliAvatarLoaded = "1";

        fetch(`${base}/api/admin/order/${encodeURIComponent(orderNumber)}/customer-photos`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.json().catch(() => null))
          .then((j) => {
            const url = j?.success && j?.data?.photos?.[0]?.url;
            if (!url || !customerCell.isConnected) return;

            const wrapper = document.createElement("div");
            wrapper.style.cssText = "display:flex;align-items:center;gap:9px;min-width:150px";

            const avatar = document.createElement("div");
            avatar.style.cssText = "width:36px;height:36px;border-radius:50%;overflow:hidden;flex-shrink:0;display:grid;place-items:center;background:#f8fafc;border:1.5px solid #be123c;box-shadow:0 2px 6px rgba(0,0,0,.08)";

            const img = document.createElement("img");
            img.src = url;
            img.alt = "Mijoz";
            img.style.cssText = "width:100%;height:100%;object-fit:cover";
            avatar.appendChild(img);

            while (customerCell.firstChild) customerCell.removeChild(customerCell.firstChild);
            const text = document.createElement("div");
            text.style.cssText = "min-width:0";
            const name = document.createElement("b");
            name.textContent = (j?.data?.customer?.first_name || "Mijoz");
            name.style.cssText = "display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
            const meta = document.createElement("small");
            meta.textContent = j?.data?.customer?.username ? `@${j.data.customer.username}` : "";
            text.append(name, meta);
            wrapper.append(avatar, text);
            customerCell.appendChild(wrapper);
          })
          .catch(() => {});
      });
    });
  };

  const observer = new MutationObserver(enhance);
  const start = () => {
    enhance();
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start();
  else window.addEventListener("DOMContentLoaded", start, { once: true });
}

installOrdersAvatarBridge();

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
