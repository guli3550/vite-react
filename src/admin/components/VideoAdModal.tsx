import React, { useState, useEffect } from "react";
import type { VideoAd } from "../../types/videoAd";
import { getApiBaseUrl } from "../../lib/apiOrigin";

interface VideoAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingAd?: VideoAd | null;
  notify: (msg: string) => void;
}

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
      setPosterSourceMode("url");
    } else {
      setTitle("");
      setDescription("");
      setVideoUrl("");
      setPosterUrl("");
      setCtaText("Batafsil");
      setDestinationUrl("");
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

  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setErrorMessage("Faqat video fayl tanlang (MP4, WebM)");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage("Video hajmi 50 MB dan oshmasligi kerak");
      return;
    }

    setUploadingVideo(true);
    setUploadProgress(15);
    setErrorMessage("");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          setUploadProgress(45);
          const base64 = String(reader.result || "").split(",")[1];
          const token = sessionStorage.getItem("guli_admin_token") || "";
          const apiBase = getApiBaseUrl();

          const res = await fetch(`${apiBase}/api/admin/video-ads/upload`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              data: base64,
              mimeType: file.type,
              extension: file.name.split(".").pop(),
              mediaType: "video",
            }),
          });

          setUploadProgress(85);
          const data = await res.json();

          if (!res.ok || !data.success) {
            throw new Error(data.message || "Videoni yuklashda xatolik");
          }

          setVideoUrl(data.url);
          setUploadProgress(100);
          notify("Video muvaffaqiyatli yuklandi ✓");
        } catch (err: any) {
          setErrorMessage(err.message || "Video yuklash xatosi");
        } finally {
          setUploadingVideo(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadingVideo(false);
      setErrorMessage(err.message || "Faylni o‘qishda xatolik");
    }
  };

  const handlePosterFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Faqat rasm fayl tanlang (JPG, PNG, WebP)");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setErrorMessage("Poster rasmi hajmi 6 MB dan oshmasligi kerak");
      return;
    }

    setUploadingPoster(true);
    setErrorMessage("");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = String(reader.result || "").split(",")[1];
          const token = sessionStorage.getItem("guli_admin_token") || "";
          const apiBase = getApiBaseUrl();

          const res = await fetch(`${apiBase}/api/admin/video-ads/upload`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              data: base64,
              mimeType: file.type,
              extension: file.name.split(".").pop(),
              mediaType: "image",
            }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.message || "Posterni yuklashda xatolik");
          }

          setPosterUrl(data.url);
          notify("Poster rasmi yuklandi ✓");
        } catch (err: any) {
          setErrorMessage(err.message || "Poster yuklash xatosi");
        } finally {
          setUploadingPoster(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadingPoster(false);
      setErrorMessage(err.message || "Faylni o‘qishda xatolik");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!title.trim()) {
      setErrorMessage("Reklama nomi talab qilinadi");
      return;
    }

    if (!videoUrl.trim()) {
      setErrorMessage("Video fayl yuklang yoki video URL kiriting");
      return;
    }

    setSubmitting(true);
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
        priority: Number(priority) || 0,
        frequency_cap: Number(frequencyCap) || 5,
        is_active: isActive,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      };

      const url = editingAd
        ? `${apiBase}/api/admin/video-ads/${editingAd.id}`
        : `${apiBase}/api/admin/video-ads`;

      const method = editingAd ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Saqlashda xatolik yuz berdi");
      }

      notify(editingAd ? "Video reklama yangilandi ✓" : "Yangi video reklama yaratildi ✓");
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Saqlashda server xatosi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-pink-500/30 rounded-2xl p-6 text-white shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <h2 className="text-xl font-bold text-pink-400">
            {editingAd ? "Video reklamani tahrirlash" : "Yangi video reklama qo‘shish"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl p-1"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-950/80 border border-red-500/50 rounded-lg text-red-200 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sarlavha & Tavsif */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Reklama nomi *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Yangi Ipak Pijamalar To‘plami"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Qisqa tavsif
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Reklama haqida qo‘shimcha ma'lumot..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500"
            />
          </div>

          {/* Video manbasi (Yuklash yoki URL) */}
          <div className="p-4 bg-slate-800/70 border border-slate-700/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-pink-300 uppercase tracking-wide">
                Video Fayl Manbasi *
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVideoSourceMode("upload")}
                  className={`text-xs px-2.5 py-1 rounded-md transition ${
                    videoSourceMode === "upload"
                      ? "bg-pink-600 text-white font-semibold"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  Fayl yuklash
                </button>
                <button
                  type="button"
                  onClick={() => setVideoSourceMode("url")}
                  className={`text-xs px-2.5 py-1 rounded-md transition ${
                    videoSourceMode === "url"
                      ? "bg-pink-600 text-white font-semibold"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  Video URL
                </button>
              </div>
            </div>

            {videoSourceMode === "upload" ? (
              <div>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleVideoFileUpload}
                  disabled={uploadingVideo}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-pink-600 file:text-white hover:file:bg-pink-700 cursor-pointer"
                />
                {uploadingVideo && (
                  <div className="mt-2 text-xs text-pink-400">
                    Video yuklanmoqda... {uploadProgress}%
                  </div>
                )}
                {videoUrl && (
                  <p className="mt-1 text-xs text-emerald-400 truncate">
                    ✓ Tanlangan: {videoUrl}
                  </p>
                )}
              </div>
            ) : (
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://... (mp4 yoki webm video havola)"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500"
              />
            )}
          </div>

          {/* Poster rasmi */}
          <div className="p-4 bg-slate-800/70 border border-slate-700/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-pink-300 uppercase tracking-wide">
                Poster (Muqova rasmi)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPosterSourceMode("upload")}
                  className={`text-xs px-2.5 py-1 rounded-md transition ${
                    posterSourceMode === "upload"
                      ? "bg-pink-600 text-white font-semibold"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  Rasm yuklash
                </button>
                <button
                  type="button"
                  onClick={() => setPosterSourceMode("url")}
                  className={`text-xs px-2.5 py-1 rounded-md transition ${
                    posterSourceMode === "url"
                      ? "bg-pink-600 text-white font-semibold"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  Rasm URL
                </button>
              </div>
            </div>

            {posterSourceMode === "upload" ? (
              <div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePosterFileUpload}
                  disabled={uploadingPoster}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-pink-600 file:text-white hover:file:bg-pink-700 cursor-pointer"
                />
                {uploadingPoster && (
                  <div className="mt-2 text-xs text-pink-400">Rasm yuklanmoqda...</div>
                )}
                {posterUrl && (
                  <p className="mt-1 text-xs text-emerald-400 truncate">
                    ✓ Tanlangan: {posterUrl}
                  </p>
                )}
              </div>
            ) : (
              <input
                type="url"
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
                placeholder="https://... (jpg, png yoki webp muqova rasmi)"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500"
              />
            )}
          </div>

          {/* Jonli Video Preview */}
          {videoUrl && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="block text-xs font-semibold text-slate-400 mb-2">
                Jonli Video Ko‘rinishi:
              </span>
              <div className="relative aspect-video max-h-52 w-full mx-auto rounded-lg overflow-hidden bg-black flex items-center justify-center">
                <video
                  src={videoUrl}
                  poster={posterUrl || undefined}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}

          {/* CTA & Manzil */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tugma matni (CTA)
              </label>
              <input
                type="text"
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                placeholder="Batafsil / Xarid qilish"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                O‘tish manzili (URL yoki havola)
              </label>
              <input
                type="text"
                value={destinationUrl}
                onChange={(e) => setDestinationUrl(e.target.value)}
                placeholder="/?category=Pijamalar yoki https://..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          {/* Joylashtirish & Platforma */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Joylashtirish (Placement)
              </label>
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500"
              >
                <option value="home">Bosh sahifa (Home Banner ostida)</option>
                <option value="product_feed">Mahsulotlar oqimida (In-feed)</option>
                <option value="all">Barcha joylarda (Bosh sahifa + Katalog)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Platforma
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500"
              >
                <option value="all">Barchasi (Sayt + Telegram Mini App)</option>
                <option value="web">Faqat Veb-sayt</option>
                <option value="telegram">Faqat Telegram Mini App</option>
              </select>
            </div>
          </div>

          {/* Prioritet & Muddat */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Prioritet (0 - 100)
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Boshlanish sanasi
              </label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tugash sanasi
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          {/* Faollik switch */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="ad_active_toggle"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 bg-slate-800 border-slate-700 cursor-pointer"
            />
            <label htmlFor="ad_active_toggle" className="text-sm font-medium text-slate-200 cursor-pointer">
              Reklama faol (Mijozlarga ko‘rsatilsin)
            </label>
          </div>

          {/* Submit buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={submitting || uploadingVideo || uploadingPoster}
              className="px-6 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold rounded-lg text-sm shadow-md transition disabled:opacity-50"
            >
              {submitting ? "Saqlanmoqda..." : editingAd ? "O‘zgarishlarni saqlash" : "Reklamani yaratish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
