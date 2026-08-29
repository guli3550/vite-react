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
        >
          🌷
        </div>
      </div>
    </header>
  );
}
