import React, { useState, useEffect, useRef } from "react";
import type { VideoAd } from "../../types/videoAd";
import { getApiBaseUrl } from "../../lib/apiOrigin";

interface VideoAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingAd?: VideoAd | null;
  notify: (msg: string) => void;
}

const CTA_PRESETS = [
  "Batafsil",
  "Xarid qilish",
  "Katalogga o‘tish",
  "Aksiyani ko‘rish",
  "Buyurtma berish",
];

const ROUTE_PRESETS = [
  { label: "Bosh sahifa", url: "/" },
  { label: "Katalog", url: "/catalog" },
  { label: "Pijamalar", url: "/catalog?category=Pijamalar" },
  { label: "Kolleksiya", url: "/catalog?category=Kolleksiya" },
];

export const VideoAdModal: React.FC<VideoAdModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editingAd,
  notify,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [ctaText, setCtaText] = useState("Batafsil");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [productId, setProductId] = useState("");
  const [placement, setPlacement] = useState<"home" | "product_feed" | "all">("home");
  const [platform, setPlatform] = useState<"all" | "web" | "telegram">("all");
  const [priority, setPriority] = useState<number>(10);
  const [frequencyCap, setFrequencyCap] = useState<number>(5);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [videoSourceMode, setVideoSourceMode] = useState<"upload" | "url">("upload");
  const [posterSourceMode, setPosterSourceMode] = useState<"upload" | "url">("upload");

  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [previewTab, setPreviewTab] = useState<"telegram" | "web">("telegram");
  const [previewMuted, setPreviewMuted] = useState(true);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (editingAd) {
      setTitle(editingAd.title || "");
      setDescription(editingAd.description || "");
      setVideoUrl(editingAd.video_url || "");
      setPosterUrl(editingAd.poster_url || "");
      setCtaText(editingAd.cta_text || "Batafsil");
      setDestinationUrl(editingAd.destination_url || "");
      setProductId(editingAd.product_id || "");
      setPlacement(editingAd.placement || "home");
      setPlatform(editingAd.platform || "all");
      setPriority(editingAd.priority ?? 10);
      setFrequencyCap(editingAd.frequency_cap ?? 5);
      setIsActive(editingAd.is_active !== false);
      setStartsAt(editingAd.starts_at ? editingAd.starts_at.slice(0, 16) : "");
      setEndsAt(editingAd.ends_at ? editingAd.ends_at.slice(0, 16) : "");
      setVideoSourceMode("url");
      setPosterSourceMode(editingAd.poster_url ? "url" : "upload");
    } else {
      setTitle("");
      setDescription("");
      setVideoUrl("");
      setPosterUrl("");
      setCtaText("Batafsil");
      setDestinationUrl("/catalog");
      setProductId("");
      setPlacement("home");
      setPlatform("all");
      setPriority(10);
      setFrequencyCap(5);
      setIsActive(true);
      setStartsAt("");
      setEndsAt("");
      setVideoSourceMode("upload");
      setPosterSourceMode("upload");
    }
    setErrorMessage("");
  }, [editingAd, isOpen]);

  if (!isOpen) return null;

  const uploadMediaFile = async (
    file: File,
    mediaType: "video" | "image",
    onProgress?: (percent: number) => void,
  ): Promise<string> => {
    const token = sessionStorage.getItem("guli_admin_token") || "";
    const apiBase = getApiBaseUrl();
    const signedResponse = await fetch(apiBase + "/api/admin/video-ads/upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        mediaType,
      }),
    });
    const signedData = await signedResponse.json();
    if (!signedResponse.ok || !signedData.success || !signedData.signedUrl || !signedData.url) {
      throw new Error(signedData.message || "Xavfsiz yuklash havolasini olishda xatolik");
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", signedData.signedUrl);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve();
        } else {
          reject(new Error("Storage yuklash xatosi (HTTP " + xhr.status + ")"));
        }
      };
      xhr.onerror = () => reject(new Error("Storage bilan aloqa uzildi. Qayta urinib ko‘ring."));
      xhr.onabort = () => reject(new Error("Yuklash bekor qilindi"));
      xhr.send(file);
    });

    return signedData.url as string;
  };

  const handleVideoFileUpload = async (file: File) => {
    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Faqat MP4, WebM yoki MOV video fayl tanlang");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage("Video hajmi 50 MB dan oshmasligi kerak");
      return;
    }

    setUploadingVideo(true);
    setUploadProgress(0);
    setErrorMessage("");

    try {
      const url = await uploadMediaFile(file, "video", setUploadProgress);
      setVideoUrl(url);
      notify("Video muvaffaqiyatli yuklandi ✓");
    } catch (err: any) {
      setErrorMessage(err.message || "Video yuklashda xatolik yuz berdi");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handlePosterFileUpload = async (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Faqat JPG, PNG yoki WebP poster tanlang");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setErrorMessage("Poster rasmi hajmi 6 MB dan oshmasligi kerak");
      return;
    }

    setUploadingPoster(true);
    setErrorMessage("");

    try {
      const url = await uploadMediaFile(file, "image");
      setPosterUrl(url);
      notify("Poster rasmi saqlandi ✓");
    } catch (err: any) {
      setErrorMessage(err.message || "Poster yuklash xatosi");
    } finally {
      setUploadingPoster(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setErrorMessage("Iltimos, reklama sarlavhasini kiriting");
      return;
    }

    if (!videoUrl.trim()) {
      setErrorMessage("Iltimos, video fayl yuklang yoki video URL manzilini kiriting");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const token = sessionStorage.getItem("guli_admin_token") || "";
      const apiBase = getApiBaseUrl();

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        video_url: videoUrl.trim(),
        poster_url: posterUrl.trim() || null,
        cta_text: ctaText.trim() || "Batafsil",
        destination_url: destinationUrl.trim() || null,
        product_id: productId.trim() || null,
        placement,
        platform,
        priority: Number(priority) || 10,
        frequency_cap: Number(frequencyCap) || 5,
        is_active: isActive,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      };

      const isEdit = !!editingAd?.id;
      const url = isEdit
        ? `${apiBase}/api/admin/video-ads/${editingAd.id}`
        : `${apiBase}/api/admin/video-ads`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Reklamani saqlashda server xatosi");
      }

      notify(isEdit ? "Reklama yangilandi ✓" : "Yangi video reklama yaratildi ✓");
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Saqlashda xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="vadsModalOverlay" onClick={onClose}>
      <div className="vadsModalCard" onClick={(e) => e.stopPropagation()}>
        {/* Modal Head */}
        <div className="vadsModalHead">
          <div>
            <h2>{editingAd ? "Video reklamani tahrirlash" : "Yangi video reklama yaratish"}</h2>
            <small style={{ color: "var(--muted)" }}>
              Sayt va Telegram Mini App foydalanuvchilariga ko‘rsatiluvchi video reklama
            </small>
          </div>
          <button type="button" onClick={onClose} className="vadsModalCloseBtn" aria-label="Yopish">
            ✕
          </button>
        </div>

        {/* Modal Body: 2 Columns on Desktop, Single Column on Mobile */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="vadsModalBody">
            {errorMessage && (
              <div
                style={{
                  background: "#fff0f2",
                  color: "#b13e55",
                  border: "1px solid #fecdd3",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  fontSize: "12px",
                  marginBottom: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
              {/* Left Column: Form Fields */}
              <div>
                {/* 1. Asosiy ma'lumotlar */}
                <div className="vadsFormSection">
                  <span className="vadsFormSectionTitle">01. Asosiy ma’lumotlar</span>

                  <div className="vadsFormGroup">
                    <label>
                      Reklama nomi <span style={{ color: "var(--rose)" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Masalan: Yangi ipak va atlas pijamalar to‘plami"
                      required
                    />
                  </div>

                  <div className="vadsFormGroup">
                    <label>Qisqa tavsif / Reklama matni</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Mijozlar e’tiborini tortuvchi qisqa izoh..."
                    />
                  </div>
                </div>

                {/* 2. Video va Poster media */}
                <div className="vadsFormSection">
                  <span className="vadsFormSectionTitle">02. Video va Muqova (Poster)</span>

                  <div className="vadsFormGroup">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <label style={{ margin: 0 }}>
                        Video manbasi <span style={{ color: "var(--rose)" }}>*</span>
                      </label>
                      <div className="vadsViewSwitch">
                        <button
                          type="button"
                          onClick={() => setVideoSourceMode("upload")}
                          className={`vadsViewBtn ${videoSourceMode === "upload" ? "active" : ""}`}
                        >
                          Fayl yuklash
                        </button>
                        <button
                          type="button"
                          onClick={() => setVideoSourceMode("url")}
                          className={`vadsViewBtn ${videoSourceMode === "url" ? "active" : ""}`}
                        >
                          URL kiritish
                        </button>
                      </div>
                    </div>

                    {videoSourceMode === "upload" ? (
                      <div className="vadsDropzone">
                        <input
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime"
                          id="modal-video-upload"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleVideoFileUpload(f);
                          }}
                        />
                        <label htmlFor="modal-video-upload" style={{ cursor: "pointer", display: "block" }}>
                          <span style={{ fontSize: "24px", display: "block", marginBottom: "4px" }}>📹</span>
                          <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--rose)" }}>
                            {uploadingVideo ? "Video yuklanmoqda..." : "MP4 video faylini tanlang"}
                          </span>
                          <small style={{ display: "block", color: "var(--muted)", fontSize: "11px", marginTop: "2px" }}>
                            Format: MP4 (H.264) · Hajmi 60 MB gacha
                          </small>
                        </label>

                        {uploadingVideo && (
                          <div style={{ height: "4px", background: "#f2e3e7", borderRadius: "99px", overflow: "hidden", marginTop: "10px" }}>
                            <div style={{ height: "100%", background: "var(--rose)", width: `${uploadProgress}%`, transition: "width 0.3s ease" }} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        type="url"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="https://.../video.mp4"
                      />
                    )}

                    {videoUrl && (
                      <div style={{ marginTop: "6px", fontSize: "11px", color: "#059669", background: "#ecfdf5", padding: "6px 10px", borderRadius: "8px", border: "1px solid #a7f3d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }}>
                          ✓ Video tayyor: {videoUrl}
                        </span>
                        <button
                          type="button"
                          onClick={() => setVideoUrl("")}
                          style={{ border: 0, background: "transparent", color: "#dc2626", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}
                        >
                          Tozalash
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="vadsFormGroup">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <label style={{ margin: 0 }}>Muqova (Poster / Cover) rasm</label>
                      <div className="vadsViewSwitch">
                        <button
                          type="button"
                          onClick={() => setPosterSourceMode("upload")}
                          className={`vadsViewBtn ${posterSourceMode === "upload" ? "active" : ""}`}
                        >
                          Yuklash
                        </button>
                        <button
                          type="button"
                          onClick={() => setPosterSourceMode("url")}
                          className={`vadsViewBtn ${posterSourceMode === "url" ? "active" : ""}`}
                        >
                          URL
                        </button>
                      </div>
                    </div>

                    {posterSourceMode === "upload" ? (
                      <div className="vadsDropzone" style={{ padding: "12px" }}>
                        <input
                          type="file"
                          accept="image/*"
                          id="modal-poster-upload"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handlePosterFileUpload(f);
                          }}
                        />
                        <label htmlFor="modal-poster-upload" style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                          <span>🖼️</span>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink)" }}>
                            {uploadingPoster ? "Poster yuklanmoqda..." : "Poster rasmini tanlash"}
                          </span>
                        </label>
                      </div>
                    ) : (
                      <input
                        type="url"
                        value={posterUrl}
                        onChange={(e) => setPosterUrl(e.target.value)}
                        placeholder="https://.../cover.webp"
                      />
                    )}
                  </div>
                </div>

                {/* 3. CTA va Yo'naltirish */}
                <div className="vadsFormSection">
                  <span className="vadsFormSectionTitle">03. CTA Tugmasi va Havola</span>

                  <div className="vadsFormGroup">
                    <label>Tugma matni (CTA text)</label>
                    <input
                      type="text"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      placeholder="Batafsil"
                    />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                      {CTA_PRESETS.map((txt) => (
                        <button
                          key={txt}
                          type="button"
                          onClick={() => setCtaText(txt)}
                          className={`vadsChip ${ctaText === txt ? "active" : ""}`}
                          style={{ fontSize: "11px", padding: "3px 8px" }}
                        >
                          {txt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="vadsFormGroup">
                    <label>O‘tish manzili (Destination URL yoki ichki route)</label>
                    <input
                      type="text"
                      value={destinationUrl}
                      onChange={(e) => setDestinationUrl(e.target.value)}
                      placeholder="/catalog?category=Pijamalar"
                      style={{ fontFamily: "monospace", fontSize: "12px" }}
                    />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                      {ROUTE_PRESETS.map((rt) => (
                        <button
                          key={rt.label}
                          type="button"
                          onClick={() => setDestinationUrl(rt.url)}
                          className={`vadsChip ${destinationUrl === rt.url ? "active" : ""}`}
                          style={{ fontSize: "11px", padding: "3px 8px" }}
                        >
                          {rt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Joylashuv va Platforma */}
                <div className="vadsFormSection">
                  <span className="vadsFormSectionTitle">04. Joylashuv va Rejalashtirish</span>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                    <div className="vadsFormGroup" style={{ margin: 0 }}>
                      <label>Joylashuv</label>
                      <select
                        value={placement}
                        onChange={(e) => setPlacement(e.target.value as any)}
                      >
                        <option value="home">Bosh sahifa</option>
                        <option value="product_feed">Mahsulotlar oqimi</option>
                        <option value="all">Barchasi</option>
                      </select>
                    </div>

                    <div className="vadsFormGroup" style={{ margin: 0 }}>
                      <label>Platforma</label>
                      <select
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value as any)}
                      >
                        <option value="all">Hammasi (Veb + TG)</option>
                        <option value="web">Faqat Veb</option>
                        <option value="telegram">Faqat Telegram</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div className="vadsFormGroup" style={{ margin: 0 }}>
                      <label>Ustuvorlik (Priority: 1-100)</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={priority}
                        onChange={(e) => setPriority(Number(e.target.value))}
                      />
                    </div>

                    <div className="vadsFormGroup" style={{ margin: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", paddingBottom: "8px" }}>
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                          style={{ width: "18px", height: "18px", accentColor: "var(--rose)" }}
                        />
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--ink)" }}>
                          Faol (Efirda ko‘rsatilsin)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Mobile Preview Simulation */}
              <div style={{ background: "#fffafb", border: "1px solid #f2e3e7", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 750, color: "var(--ink)" }}>
                    📱 Jonli ko‘rinish simulyatsiyasi
                  </span>
                  <div className="vadsViewSwitch">
                    <button
                      type="button"
                      onClick={() => setPreviewTab("telegram")}
                      className={`vadsViewBtn ${previewTab === "telegram" ? "active" : ""}`}
                    >
                      Telegram
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("web")}
                      className={`vadsViewBtn ${previewTab === "web" ? "active" : ""}`}
                    >
                      Veb
                    </button>
                  </div>
                </div>

                {/* Simulated Phone Frame */}
                <div
                  style={{
                    width: "100%",
                    maxWidth: "300px",
                    borderRadius: "22px",
                    background: "#181116",
                    border: "5px solid #2d1f28",
                    padding: "8px",
                    boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
                    color: "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#a68f98", marginBottom: "6px", padding: "0 2px" }}>
                    <span>9:41</span>
                    <span>{previewTab === "telegram" ? "Telegram Mini App" : "gulii.uz"}</span>
                    <span>🔋 99%</span>
                  </div>

                  <div
                    style={{
                      position: "relative",
                      borderRadius: "14px",
                      overflow: "hidden",
                      background: "#000",
                      aspectRatio: "16 / 10",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                    }}
                  >
                    {videoUrl ? (
                      <video
                        ref={previewVideoRef}
                        src={videoUrl}
                        poster={posterUrl || undefined}
                        muted={previewMuted}
                        autoPlay
                        loop
                        playsInline
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : posterUrl ? (
                      <img
                        src={posterUrl}
                        alt=""
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#8d7d84", fontSize: "11px", textAlign: "center", padding: "10px" }}>
                        Video yoki poster kiritilganda bu yerda avtomatik ijro etiladi
                      </div>
                    )}

                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.15) 60%, transparent)", pointerEvents: "none" }} />

                    <div style={{ position: "absolute", top: "6px", left: "6px", display: "flex", gap: "4px", zIndex: 2 }}>
                      <span style={{ fontSize: "8.5px", fontWeight: 800, padding: "2px 5px", borderRadius: "4px", background: "rgba(0,0,0,0.7)", color: "#fbcfe8", border: "1px solid rgba(244,114,182,0.3)" }}>
                        REKLAMA
                      </span>
                      <span style={{ fontSize: "8.5px", fontWeight: 600, padding: "2px 5px", borderRadius: "4px", background: "rgba(0,0,0,0.6)", color: "#fff" }}>
                        {placement === "home" ? "Bosh sahifa" : "In-feed"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPreviewMuted(!previewMuted);
                        if (previewVideoRef.current) {
                          previewVideoRef.current.muted = !previewMuted;
                        }
                      }}
                      style={{
                        position: "absolute",
                        top: "6px",
                        right: "6px",
                        zIndex: 2,
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.2)",
                        fontSize: "10px",
                        cursor: "pointer",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {previewMuted ? "🔇" : "🔊"}
                    </button>

                    <div style={{ position: "relative", zIndex: 2, padding: "8px" }}>
                      <h4 style={{ margin: "0 0 2px", fontSize: "11px", fontWeight: 750, color: "#ffffff", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                        {title || "Sarlavha bu yerda ko‘rinadi"}
                      </h4>
                      {description && (
                        <p style={{ margin: "0 0 5px", fontSize: "9.5px", color: "#e2d9dc", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                          {description}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => notify(`CTA sinovi: ${destinationUrl || "/"}`)}
                        className="vadsPrimaryBtn"
                        style={{ width: "100%", padding: "6px 8px", fontSize: "10.5px", minHeight: "32px", borderRadius: "8px" }}
                      >
                        {ctaText || "Batafsil"} →
                      </button>
                    </div>
                  </div>
                </div>

                <small style={{ marginTop: "10px", color: "var(--muted)", fontSize: "11px", textAlign: "center" }}>
                  Mijozlar reklamani aynan shu ko‘rinishda ko‘rishadi.
                </small>
              </div>
            </div>
          </div>

          {/* Modal Foot */}
          <div className="vadsModalFoot">
            <button type="button" onClick={onClose} className="vadsSecondaryBtn">
              Bekor qilish
            </button>
            <button type="submit" disabled={submitting} className="vadsPrimaryBtn">
              {submitting ? "Saqlanmoqda..." : editingAd ? "O‘zgarishlarni saqlash ✓" : "Reklamani yaratish ✓"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
