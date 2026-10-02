import React, { useEffect, useRef, useState } from "react";
import type {
  SocialPlatform,
  SocialPromoItem,
  SocialPromoRowSetting,
} from "../../types/socialPromo";
import { getApiBaseUrl } from "../../lib/apiOrigin";
import {
  PlatformLogoRenderer,
} from "../../components/socialPromo/SocialPlatformLogos";
import { SocialPromoMarqueeRow } from "../../components/socialPromo/SocialPromoMarqueeRow";
import {
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  SAVE_DEBOUNCE_MS,
  classifyDurationDraft,
  createLatestGate,
  defaultDirectionForRow,
  defaultDurationForRow,
  type LatestGate,
} from "../../lib/socialPromoMotion";

interface AdminSocialPromosTabProps {
  notify: (msg: string) => void;
}

export const AdminSocialPromosTab: React.FC<AdminSocialPromosTabProps> = ({ notify }) => {
  const [items, setItems] = useState<SocialPromoItem[]>([]);
  const [settings, setSettings] = useState<SocialPromoRowSetting[]>([
    { row_number: 1, is_enabled: true, direction: "left", duration_seconds: 34 },
    { row_number: 2, is_enabled: true, direction: "right", duration_seconds: 42 },
    { row_number: 3, is_enabled: true, direction: "left", duration_seconds: 36 },
  ]);
  const [loading, setLoading] = useState(true);
  const [filterRow, setFilterRow] = useState<number | "all">("all");
  const [previewViewport, setPreviewViewport] = useState<"mobile" | "desktop">("mobile");

  // Speed input drafts (text as typed). A draft is only sent to the server when it is a valid
  // 5-180 value, after a short pause, or on blur/Enter. Empty or garbage text is never saved.
  const [durationDrafts, setDurationDrafts] = useState<Record<number, string>>({});
  const settingsRef = useRef<SocialPromoRowSetting[]>(settings);
  settingsRef.current = settings;
  const rowGatesRef = useRef<Record<number, LatestGate>>({});
  const saveTimersRef = useRef<Record<number, number>>({});

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SocialPromoItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formPlatform, setFormPlatform] = useState<SocialPlatform>("instagram");
  const [formLabel, setFormLabel] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formLogoUrl, setFormLogoUrl] = useState<string | null>(null);
  const [formRow, setFormRow] = useState<1 | 2 | 3>(1);
  const [formSortOrder, setFormSortOrder] = useState<number>(10);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formOpenNewTab, setFormOpenNewTab] = useState<boolean>(true);
  const [formMobileVisible, setFormMobileVisible] = useState<boolean>(true);
  const [formStartAt, setFormStartAt] = useState<string>("");
  const [formEndAt, setFormEndAt] = useState<string>("");

  // Match the exact API origin selected during AdminPro login (gateway or direct Render fallback).
  // Sending a valid admin token to a different backend can produce a misleading 401.
  const API = (typeof window !== "undefined" ? sessionStorage.getItem("guli_custom_api_url") : "") || getApiBaseUrl();
  const API_BASE = API.replace(/\/$/, "");

  const getAdminHeaders = () => {
    const token = sessionStorage.getItem("guli_admin_token") || localStorage.getItem("guli_admin_token") || "";
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/social-promos`, {
        headers: getAdminHeaders(),
      });
      if (!res.ok) throw new Error("Yuklab bo‘lmadi");
      const json = await res.json();
      if (json.success && json.data) {
        setItems(json.data.items || []);
        if (json.data.settings?.length) {
          setSettings(json.data.settings);
        }
      }
    } catch {
      notify("Promo ma'lumotlarini yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timers = saveTimersRef.current;
    return () => {
      Object.values(timers).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const openCreateModal = (presetRow?: 1 | 2 | 3) => {
    setEditingItem(null);
    setFormTitle("");
    setFormPlatform("instagram");
    setFormLabel("Instagram · @guli_market");
    setFormUrl("https://www.instagram.com/guli_market");
    setFormLogoUrl(null);
    setFormRow(presetRow || 1);
    setFormSortOrder(10);
    setFormIsActive(true);
    setFormOpenNewTab(true);
    setFormMobileVisible(true);
    setFormStartAt("");
    setFormEndAt("");
    setIsModalOpen(true);
  };

  const openEditModal = (item: SocialPromoItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormPlatform(item.platform);
    setFormLabel(item.label);
    setFormUrl(item.target_url);
    setFormLogoUrl(item.logo_url || null);
    setFormRow(item.row_number);
    setFormSortOrder(item.sort_order || 0);
    setFormIsActive(item.is_active);
    setFormOpenNewTab(item.open_in_new_tab);
    setFormMobileVisible(item.mobile_visible !== false);
    setFormStartAt(item.start_at ? item.start_at.substring(0, 16) : "");
    setFormEndAt(item.end_at ? item.end_at.substring(0, 16) : "");
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formLabel.trim() || !formUrl.trim()) {
      notify("Barcha majburiy maydonlarni to'ldiring");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        platform: formPlatform,
        label: formLabel.trim(),
        target_url: formUrl.trim(),
        logo_url: formLogoUrl,
        row_number: formRow,
        sort_order: Number(formSortOrder) || 0,
        is_active: formIsActive,
        open_in_new_tab: formOpenNewTab,
        mobile_visible: formMobileVisible,
        start_at: formStartAt ? new Date(formStartAt).toISOString() : null,
        end_at: formEndAt ? new Date(formEndAt).toISOString() : null,
      };

      const isEdit = Boolean(editingItem);
      const url = isEdit
        ? `${API}/api/admin/social-promos/${editingItem?.id}`
        : `${API}/api/admin/social-promos`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: getAdminHeaders(),
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Saqlashda xatolik");
      }

      notify(isEdit ? "Promo tugma muvaffaqiyatli yangilandi ✓" : "Yangi promo tugma yaratildi ✓");
      setIsModalOpen(false);
      loadData();

      // Trigger public refresh event
      try {
        window.dispatchEvent(new CustomEvent("guli_refresh_social_promos"));
      } catch {}
    } catch (err: any) {
      notify(err.message || "Xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const res = await fetch(`${API}/api/admin/social-promos/${id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      notify("Promo tugma o'chirildi ✓");
      setDeletingId(null);
      loadData();
      try {
        window.dispatchEvent(new CustomEvent("guli_refresh_social_promos"));
      } catch {}
    } catch (err: any) {
      notify(err.message || "O'chirishda xatolik");
    }
  };

  const handleToggleActive = async (item: SocialPromoItem) => {
    try {
      const res = await fetch(`${API}/api/admin/social-promos/${item.id}`, {
        method: "PATCH",
        headers: getAdminHeaders(),
        body: JSON.stringify({ is_active: !item.is_active }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      notify(`Tugma ${!item.is_active ? "yoqildi (ON)" : "o‘chirildi (OFF)"} ✓`);
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, is_active: !item.is_active } : it))
      );
      try {
        window.dispatchEvent(new CustomEvent("guli_refresh_social_promos"));
      } catch {}
    } catch {
      notify("Holatni o'zgartirib bo'lmadi");
    }
  };

  const getRowGate = (rowNum: number): LatestGate => {
    if (!rowGatesRef.current[rowNum]) rowGatesRef.current[rowNum] = createLatestGate();
    return rowGatesRef.current[rowNum];
  };

  const handleSaveRowSetting = async (rowNum: 1 | 2 | 3, updates: Partial<SocialPromoRowSetting>) => {
    const existing: SocialPromoRowSetting = settingsRef.current.find((s) => s.row_number === rowNum) || {
      row_number: rowNum,
      is_enabled: true,
      direction: defaultDirectionForRow(rowNum),
      duration_seconds: defaultDurationForRow(rowNum),
    };
    const updated: SocialPromoRowSetting = { ...existing, ...updates };

    // Optimistic local update, so the next request for this row builds on the newest values and an
    // older response can never put an old value back on screen.
    const applyLocal = (prev: SocialPromoRowSetting[]): SocialPromoRowSetting[] =>
      prev.some((s) => s.row_number === rowNum)
        ? prev.map((s) => (s.row_number === rowNum ? { ...s, ...updated } : s))
        : [...prev, updated];
    settingsRef.current = applyLocal(settingsRef.current);
    setSettings(applyLocal);

    const gate = getRowGate(rowNum);
    const token = gate.next();
    try {
      const res = await fetch(`${API_BASE}/api/admin/social-promos/settings`, {
        method: "PATCH",
        headers: getAdminHeaders(),
        body: JSON.stringify(updated),
      });

      const json = await res.json();
      if (!gate.isLatest(token)) return; // a newer save for this row is in flight: ignore this response
      if (!res.ok || !json.success) throw new Error(json.message);
      notify(`${rowNum}-qator sozlamalari yangilandi ✓`);
      try {
        window.dispatchEvent(new CustomEvent("guli_refresh_social_promos"));
      } catch {}
    } catch {
      if (!gate.isLatest(token)) return;
      notify("Qator sozlamalarini saqlashda xatolik");
      loadData(); // re-sync with what the server really has
    }
  };

  const clearSaveTimer = (rowNum: number) => {
    const timer = saveTimersRef.current[rowNum];
    if (timer !== undefined) {
      window.clearTimeout(timer);
      delete saveTimersRef.current[rowNum];
    }
  };

  const dropDraft = (rowNum: number) => {
    setDurationDrafts((prev) => {
      const next = { ...prev };
      delete next[rowNum];
      return next;
    });
  };

  const commitDuration = (rowNum: 1 | 2 | 3, draft: string) => {
    clearSaveTimer(rowNum);
    const result = classifyDurationDraft(draft);
    dropDraft(rowNum);
    if (result.value === null) {
      // Empty or not a number: nothing is saved, the last saved value stays.
      notify(`Tezlik ${MIN_DURATION_SECONDS}–${MAX_DURATION_SECONDS} soniya oralig'ida bo'lishi kerak`);
      return;
    }
    if (result.status === "out_of_range") {
      notify(`Tezlik ${MIN_DURATION_SECONDS}–${MAX_DURATION_SECONDS} soniyaga moslashtirildi`);
    }
    const current = settingsRef.current.find((s) => s.row_number === rowNum)?.duration_seconds;
    if (current === result.value) return;
    void handleSaveRowSetting(rowNum, { duration_seconds: result.value });
  };

  const onDurationChange = (rowNum: 1 | 2 | 3, value: string) => {
    setDurationDrafts((prev) => ({ ...prev, [rowNum]: value }));
    clearSaveTimer(rowNum);
    // Partial typing ("3" on the way to "30"), empty or out-of-range text waits for blur/Enter.
    if (classifyDurationDraft(value).status !== "ok") return;
    saveTimersRef.current[rowNum] = window.setTimeout(() => commitDuration(rowNum, value), SAVE_DEBOUNCE_MS);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      notify("Logo hajmi 2MB dan kam bo'lishi kerak");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUri = evt.target?.result as string;
      setFormLogoUrl(dataUri);

      // Attempt upload to server storage
      try {
        const res = await fetch(`${API_BASE}/api/admin/social-promos/upload-logo`, {
          method: "POST",
          headers: getAdminHeaders(),
          body: JSON.stringify({ dataUri }),
        });
        const json = await res.json();
        if (json.success && json.data?.url) {
          setFormLogoUrl(json.data.url);
          notify("Maxsus logo yuklandi ✓");
        }
      } catch {
        // Fallback to dataUri is already active
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const filteredItems = items.filter((it) => (filterRow === "all" ? true : it.row_number === filterRow));

  return (
    <section className="proPanel" style={{ padding: "24px", maxWidth: "1150px", margin: "0 auto 30px auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <div>
          <span className="proEyebrow eyebrow">MARKETING & IJTIMOIY HAMJAMIYAT</span>
          <h2 style={{ fontSize: "24px", fontWeight: "900", margin: "4px 0", color: "var(--text-main)" }}>
            Ijtimoiy Tarmoq Promo Tugmalari
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "4px 0 0" }}>
            Profil sahifasi pastidagi 3 qatorli, uzluksiz harakatlanuvchi Instagram, Telegram va YouTube promo tugmalarini boshqaring.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreateModal()}
          style={{
            padding: "12px 20px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
            color: "#ffffff",
            border: "none",
            fontSize: "13.5px",
            fontWeight: 800,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 16px rgba(225, 29, 72, 0.35)",
          }}
        >
          <span>➕</span>
          <span>Yangi promo tugma qo‘shish</span>
        </button>
      </div>

      {/* Row Settings Management Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", marginBottom: "26px" }}>
        {[1, 2, 3].map((rNum) => {
          const rowSetting = settings.find((s) => s.row_number === rNum) || {
            row_number: rNum,
            is_enabled: true,
            direction: defaultDirectionForRow(rNum),
            duration_seconds: defaultDurationForRow(rNum),
          };
          const count = items.filter((it) => it.row_number === rNum).length;
          const draftValue = durationDrafts[rNum];
          const draftStatus = draftValue === undefined ? null : classifyDurationDraft(draftValue).status;
          const draftBad = draftStatus !== null && draftStatus !== "ok";

          return (
            <div
              key={rNum}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "18px",
                padding: "16px 18px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #e11d48, #be123c)",
                      color: "#fff",
                      fontSize: "13px",
                      fontWeight: 800,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {rNum}
                  </span>
                  <b style={{ fontSize: "14px", color: "var(--text-main)" }}>
                    {rNum}-Qator Marquee
                  </b>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px", fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    checked={rowSetting.is_enabled}
                    onChange={(e) => handleSaveRowSetting(rNum as 1 | 2 | 3, { is_enabled: e.target.checked })}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ color: rowSetting.is_enabled ? "#10b981" : "#94a3b8" }}>
                    {rowSetting.is_enabled ? "Faol (ON)" : "O‘chiq"}
                  </span>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-muted)" }}>
                <span>Tugmalar soni: <b>{count} ta</b></span>
                <span>Harakat: <b>{rowSetting.direction === "right" ? "Chapdan o‘ngga (→)" : "O‘ngdan chapga (←)"}</b></span>
              </div>

              {/* Controls */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", paddingTop: "6px", borderTop: "1px dashed var(--border-color)" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                    Yo‘nalish
                  </label>
                  <select
                    value={rowSetting.direction}
                    onChange={(e) => handleSaveRowSetting(rNum as 1 | 2 | 3, { direction: e.target.value as "left" | "right" })}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: "10px",
                      border: "1px solid var(--border-input)",
                      background: "var(--bg-input)",
                      fontSize: "12px",
                      color: "var(--text-main)",
                    }}
                  >
                    <option value="left">← Chapga (Normal)</option>
                    <option value="right">→ O‘ngga (Reverse)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                    Tezlik (sekund)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={MIN_DURATION_SECONDS}
                    max={MAX_DURATION_SECONDS}
                    step={1}
                    value={draftValue ?? String(rowSetting.duration_seconds)}
                    onChange={(e) => onDurationChange(rNum as 1 | 2 | 3, e.target.value)}
                    onBlur={(e) => {
                      if (durationDrafts[rNum] !== undefined) commitDuration(rNum as 1 | 2 | 3, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitDuration(rNum as 1 | 2 | 3, e.currentTarget.value);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "7px 10px",
                      borderRadius: "10px",
                      border: draftBad ? "1px solid #ef4444" : "1px solid var(--border-input)",
                      background: "var(--bg-input)",
                      fontSize: "12px",
                      color: "var(--text-main)",
                      boxSizing: "border-box",
                    }}
                  />
                  <small style={{ display: "block", marginTop: "3px", fontSize: "10.5px", color: draftBad ? "#ef4444" : "var(--text-muted)" }}>
                    {MIN_DURATION_SECONDS}–{MAX_DURATION_SECONDS} soniya
                  </small>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Live Preview Box */}
      <div
        style={{
          background: "var(--bg-card-sub, #faf4f6)",
          border: "1px solid var(--border-color)",
          borderRadius: "22px",
          padding: "20px",
          marginBottom: "28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>👁️</span>
            <div>
              <b style={{ fontSize: "14px", color: "var(--text-main)" }}>Jonli Preview (Live Storefront View)</b>
              <small style={{ display: "block", color: "var(--text-muted)", fontSize: "11px" }}>
                Foydalanuvchilar mobil va veb ilovada ushbu tugmalarni qanday ko‘rishini tekshiring
              </small>
            </div>
          </div>

          {/* Viewport switch */}
          <div style={{ display: "flex", gap: "6px", background: "var(--bg-card)", padding: "4px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
            <button
              type="button"
              onClick={() => setPreviewViewport("mobile")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                background: previewViewport === "mobile" ? "var(--primary, #e11d48)" : "transparent",
                color: previewViewport === "mobile" ? "#fff" : "var(--text-main)",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📱 Mobil (390px)
            </button>
            <button
              type="button"
              onClick={() => setPreviewViewport("desktop")}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "none",
                background: previewViewport === "desktop" ? "var(--primary, #e11d48)" : "transparent",
                color: previewViewport === "desktop" ? "#fff" : "var(--text-main)",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              💻 Desktop / Keng ekran
            </button>
          </div>
        </div>

        {/* Preview Frame */}
        <div
          style={{
            maxWidth: previewViewport === "mobile" ? "410px" : "100%",
            margin: "0 auto",
            background: "var(--bg-card, #ffffff)",
            borderRadius: "24px",
            padding: "18px 0",
            border: "1px solid var(--border-color)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            transition: "max-width 0.3s ease",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "0 16px 10px 16px" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, color: "#be185d", letterSpacing: "1px" }}>
              RASMIY HAMJAMIYAT
            </span>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--text-main)" }}>
              Biz ijtimoiy tarmoqlarda
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <SocialPromoMarqueeRow
              rowNumber={1}
              items={items.filter((it) => it.row_number === 1 && it.is_active)}
              setting={settings.find((s) => s.row_number === 1)}
            />
            <SocialPromoMarqueeRow
              rowNumber={2}
              items={items.filter((it) => it.row_number === 2 && it.is_active)}
              setting={settings.find((s) => s.row_number === 2)}
            />
            <SocialPromoMarqueeRow
              rowNumber={3}
              items={items.filter((it) => it.row_number === 3 && it.is_active)}
              setting={settings.find((s) => s.row_number === 3)}
            />
          </div>
        </div>
      </div>

      {/* Row Filter Pills */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {[
            { label: "Barchasi", val: "all" },
            { label: "1-Qator", val: 1 },
            { label: "2-Qator", val: 2 },
            { label: "3-Qator", val: 3 },
          ].map((pill) => (
            <button
              key={pill.label}
              type="button"
              onClick={() => setFilterRow(pill.val as any)}
              style={{
                padding: "7px 14px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                background: filterRow === pill.val ? "var(--text-main, #201c1e)" : "var(--bg-card)",
                color: filterRow === pill.val ? "#ffffff" : "var(--text-main)",
                fontSize: "12px",
                fontWeight: 750,
                cursor: "pointer",
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <span style={{ fontSize: "12.5px", color: "var(--text-muted)" }}>
          Jami tugmalar: <b>{filteredItems.length} ta</b>
        </span>
      </div>

      {/* Table of Promos */}
      <div className="tableWrap" style={{ border: "1px solid var(--border-color)", borderRadius: "18px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "var(--bg-card-sub, #faf6f7)", textAlign: "left" }}>
              <th style={{ padding: "12px 16px" }}>Platforma & Logo</th>
              <th style={{ padding: "12px 16px" }}>Promo Nomi & Matni</th>
              <th style={{ padding: "12px 16px" }}>Qator</th>
              <th style={{ padding: "12px 16px" }}>URL Havola</th>
              <th style={{ padding: "12px 16px" }}>Tartib</th>
              <th style={{ padding: "12px 16px" }}>Holat</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Amallar</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
                  Yuklanmoqda...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  Hozircha promo tugmalar topilmadi. "Yangi promo tugma qo‘shish" orqali qo‘shishingiz mumkin.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <PlatformLogoRenderer platform={item.platform} logoUrl={item.logo_url} size={26} />
                      <b style={{ textTransform: "capitalize", fontSize: "13px" }}>{item.platform}</b>
                    </div>
                  </td>

                  <td style={{ padding: "12px 16px" }}>
                    <b>{item.title}</b>
                    <small style={{ display: "block", color: "var(--text-muted)", marginTop: "2px" }}>
                      {item.label}
                    </small>
                  </td>

                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "8px",
                        background: "var(--bg-card-sub, #f3eeee)",
                        fontWeight: 800,
                        fontSize: "12px",
                      }}
                    >
                      {item.row_number}-Qator
                    </span>
                  </td>

                  <td style={{ padding: "12px 16px", maxWidth: "200px" }}>
                    <a
                      href={item.target_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "var(--primary, #e11d48)",
                        textDecoration: "none",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "block",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                      }}
                    >
                      {item.target_url} ↗
                    </a>
                  </td>

                  <td style={{ padding: "12px 16px", fontWeight: 700 }}>
                    {item.sort_order}
                  </td>

                  <td style={{ padding: "12px 16px" }}>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "999px",
                        border: "none",
                        background: item.is_active ? "#dcfce7" : "#f1eeee",
                        color: item.is_active ? "#15803d" : "#71717a",
                        fontSize: "11px",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {item.is_active ? "● Faol (ON)" : "○ O‘chiq (OFF)"}
                    </button>
                  </td>

                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-color)",
                          background: "var(--bg-card)",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        ✏️ Tahrirlash
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingId(item.id)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          background: "rgba(239, 68, 68, 0.08)",
                          color: "#ef4444",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            backgroundColor: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            padding: "16px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: "var(--bg-card, #ffffff)",
              color: "var(--text-main)",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 25px 80px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>
                {editingItem ? "Promo tugmani tahrirlash" : "Yangi promo tugma qo‘shish"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ border: "none", background: "transparent", fontSize: "20px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Promo Nomi */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                  Promo nomi (Ichki boshqaruv uchun) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Instagram Rasmiy"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-input)",
                    background: "var(--bg-input)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Platform Selector */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                  Platforma *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                  {(["instagram", "telegram", "youtube", "custom"] as SocialPlatform[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setFormPlatform(p);
                        if (!editingItem) {
                          if (p === "instagram") {
                            setFormLabel("Instagram · @guli_market");
                            setFormUrl("https://www.instagram.com/guli_market");
                          } else if (p === "telegram") {
                            setFormLabel("Telegram · Rasmiy kanal");
                            setFormUrl("https://t.me/guli_market");
                          } else if (p === "youtube") {
                            setFormLabel("YouTube · Guli Market TV");
                            setFormUrl("https://www.youtube.com/@guli_market");
                          }
                        }
                      }}
                      style={{
                        padding: "10px 6px",
                        borderRadius: "12px",
                        border: formPlatform === p ? "2px solid #e11d48" : "1px solid var(--border-color)",
                        background: formPlatform === p ? "rgba(225, 29, 72, 0.08)" : "var(--bg-card)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <PlatformLogoRenderer platform={p} size={24} />
                      <span style={{ fontSize: "11px", fontWeight: 750, textTransform: "capitalize" }}>{p}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tugma matni */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                  Tugmada ko‘rinadigan matn *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Telegram · Rasmiy kanal"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-input)",
                    background: "var(--bg-input)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Yo‘naltiruvchi URL */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                  Yo‘naltiruvchi URL manzil *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://t.me/guli_market yoki https://instagram.com/..."
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-input)",
                    background: "var(--bg-input)",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Logo Tanlash / Maxsus Logo Yuklash */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                  Logo (Standart yoki Maxsus)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", background: "var(--bg-card-sub)", borderRadius: "12px" }}>
                  <PlatformLogoRenderer platform={formPlatform} logoUrl={formLogoUrl} size={30} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: 700 }}>
                      {formLogoUrl ? "Maxsus logo yuklangan" : `Standart ${formPlatform} logosi`}
                    </div>
                    {formLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setFormLogoUrl(null)}
                        style={{ border: "none", background: "none", color: "#e11d48", fontSize: "11px", padding: 0, cursor: "pointer", textDecoration: "underline" }}
                      >
                        Standart logoga qaytarish
                      </button>
                    )}
                  </div>

                  <label
                    style={{
                      padding: "6px 12px",
                      borderRadius: "10px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Rasm yuklash
                    <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: "none" }} />
                  </label>
                </div>
              </div>

              {/* Qator va Tartib */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                    Qator (1–3) *
                  </label>
                  <select
                    value={formRow}
                    onChange={(e) => setFormRow(Number(e.target.value) as 1 | 2 | 3)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "12px",
                      border: "1px solid var(--border-input)",
                      background: "var(--bg-input)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value={1}>1-Qator (Yuqori)</option>
                    <option value={2}>2-Qator (O‘rta)</option>
                    <option value={3}>3-Qator (Pastki)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "4px" }}>
                    Tartib raqami (Sort order)
                  </label>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(Number(e.target.value) || 0)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "12px",
                      border: "1px solid var(--border-input)",
                      background: "var(--bg-input)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                  />
                  <span>Faol ko‘rinish (ON)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", fontWeight: 700, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formOpenNewTab}
                    onChange={(e) => setFormOpenNewTab(e.target.checked)}
                  />
                  <span>Yangi oynada ochish</span>
                </label>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "12px",
                    border: "none",
                    background: "linear-gradient(135deg, #e11d48, #be123c)",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: submitting ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(225, 29, 72, 0.4)",
                  }}
                >
                  {submitting ? "Saqlanmoqda..." : "Saqlash ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            backgroundColor: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "380px",
              backgroundColor: "var(--bg-card, #ffffff)",
              color: "var(--text-main)",
              borderRadius: "22px",
              padding: "24px",
              textAlign: "center",
              boxShadow: "0 25px 80px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontSize: "40px", marginBottom: "10px" }}>⚠️</div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "17px", fontWeight: 800 }}>
              Promo tugmani o‘chirish
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "var(--text-muted)" }}>
              Haqiqatan ham ushbu ijtimoiy promo tugmani o‘chirmoqchimisiz?
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                style={{
                  padding: "10px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => handleDeleteItem(deletingId)}
                style={{
                  padding: "10px",
                  borderRadius: "12px",
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Ha, o‘chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
