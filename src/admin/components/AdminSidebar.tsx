import { SIDEBAR_NAV_ITEMS, type NavTabKey, type NavItem } from "./AdminSidebarData";

export type { NavTabKey, NavItem };

type AdminSidebarProps = {
  currentTab: NavTabKey;
  onSelectTab: (tab: NavTabKey) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  unreadChatCount?: number;
};

export function AdminSidebar({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  onLogout,
  unreadChatCount = 0,
}: AdminSidebarProps) {
  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {isOpenMobile && (
        <div
          className="adminSidebarBackdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`proSide ${isOpenMobile ? "mobileDrawerOpen" : ""}`}>
        {/* Brand Header */}
        <div className="proBrand">
          <span>🌷</span>
          <div>
            <b>GULI</b>
            <small>PREMIUM ADMIN</small>
          </div>
          {isOpenMobile && (
            <button
              type="button"
              className="drawerCloseBtn"
              onClick={onCloseMobile}
              aria-label="Yopish"
            >
              ×
            </button>
          )}
        </div>

        {/* 15 Nav Items */}
        <div className="sideNav">
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const isActive = currentTab === item.key;
            const badgeValue =
              item.key === "chat" && unreadChatCount > 0 ? unreadChatCount : item.badge;

            return (
              <button
                key={item.key}
                type="button"
                className={isActive ? "active" : ""}
                onClick={() => {
                  onSelectTab(item.key);
                  onCloseMobile();
                }}
              >
                <i className="navIcon">{item.icon}</i>
                <span className="navLabel">{item.label}</span>
                {badgeValue ? (
                  <span className="navBadge">{badgeValue}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Bottom Profile & Exit Section */}
        <div className="sideBottom">
          <div className="adminProfileMiniCard">
            <div className="adminAvatarCircle">🌷</div>
            <div className="adminProfileDetails">
              <b>Guli Admin</b>
              <small>Super Administrator</small>
            </div>
          </div>

          <a
            href="/"
            className="exitToClientBtn"
            title="Mijoz web app'ga qaytish"
          >
            🛍️ Web App'ga chiqish
          </a>

          <button type="button" className="logoutBtn" onClick={onLogout}>
            🚪 Chiqish
          </button>
        </div>
      </aside>
    </>
  );
}
