import { type PlatformType } from "../../utils/platformAdapter";

type AdminHeaderProps = {
  title: string;
  onToggleSidebar: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  unreadNotificationsCount?: number;
  isRinging?: boolean;
  activePlatform: PlatformType;
  onPlatformChange: (p: PlatformType) => void;
  onRefresh: () => void;
  isBusy: boolean;
  onSelectTab: (tab: any) => void;
};

export function AdminHeader({
  title,
  onToggleSidebar,
  searchQuery,
  onSearchChange,
  unreadNotificationsCount = 0,
  isRinging = false,
  activePlatform,
  onPlatformChange,
  onRefresh,
  isBusy,
  onSelectTab,
}: AdminHeaderProps) {
  void activePlatform;
  void onPlatformChange;
  void onRefresh;
  void isBusy;
  return (
    <header className="proTop guliAdminTopHeader">
      <div className="headerLeftSection">
        <button
          type="button"
          className="hamburgerMenuBtn"
          onClick={onToggleSidebar}
          title="Menuni ochish"
        >
          ☰
        </button>
        <div className="headerTitleBlock">
          <span className="proEyebrow">GULI CONTROL CENTER</span>
          <h1>{title}</h1>
        </div>
      </div>

      <div className="headerCenterSearch">
        <div className="headerSearchBox">
          <span className="searchIcon">⌕</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Qidirish (mahsulot, buyurtma, mijoz)..."
          />
          {searchQuery && (
            <button
              type="button"
              className="clearSearchBtn"
              onClick={() => onSearchChange("")}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="topActions headerRightActions">
        <button
          type="button"
          onClick={() => onSelectTab("guli_chat")}
          className="guliHeaderAiBtn"
          title="Guli AI Chat (ChatGPT uslubidagi assistent)"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "6px 12px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, rgba(190, 18, 60, 0.08), rgba(244, 63, 94, 0.12))",
            border: "1px solid rgba(190, 18, 60, 0.2)",
            color: "#be123c",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontSize: "14px" }}>✨</span>
          <span>Guli AI</span>
        </button>

        <button
          type="button"
          className={`notifBellBtn ${isRinging || unreadNotificationsCount > 0 ? "ring3dAnim" : ""}`}
          onClick={() => onSelectTab("chat")}
          title="Online Chat (Yangi xabarlar)"
        >
          <span style={{ display: "inline-block", transform: isRinging ? "scale(1.2)" : "none", transition: "transform 0.2s" }}>🔔</span>
          {unreadNotificationsCount > 0 && (
            <span className="notifBadge">{unreadNotificationsCount}</span>
          )}
        </button>

        <a
          href="/"
          className="exitWebAppTopBtn"
          title="Mijoz web app'ga qaytish"
        >
          🛍️ Web App
        </a>

        <div
          className="adminHeaderAvatar"
          onClick={() => onSelectTab("settings")}
          title="Sozlamalar"
          style={{ overflow: "hidden", padding: 0 }}
        >
          <img
            src="/guli-logo.webp"
            alt="Guli"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </div>
    </header>
  );
}
