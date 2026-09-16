import React, { useState, useRef, useEffect } from "react";
import { Play, Volume2, VolumeX, RotateCcw, Check, X } from "lucide-react";

interface CircleVideoNotePlayerProps {
  mediaUrl: string;
  duration?: number;
  className?: string;
}

export const CircleVideoNotePlayer: React.FC<CircleVideoNotePlayerProps> = ({
  mediaUrl,
  duration = 0,
  className = "",
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration || 0);
  const [showMuteNotice, setShowMuteNotice] = useState(false);

  const radius = 96;
  const stroke = 3.5;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;

  const progress = videoDuration > 0 ? currentTime / videoDuration : 0;
  const strokeDashoffset = circumference - progress * circumference;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handleTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      if (v.duration && !Number.isNaN(v.duration)) {
        setVideoDuration(v.duration);
      }
    };

    const handleEnded = () => {
      v.currentTime = 0;
      v.play().catch(() => {});
    };

    const handleLoadedMetadata = () => {
      if (v.duration && !Number.isNaN(v.duration)) {
        setVideoDuration(v.duration);
      }
    };

    v.addEventListener("timeupdate", handleTimeUpdate);
    v.addEventListener("ended", handleEnded);
    v.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      v.removeEventListener("timeupdate", handleTimeUpdate);
      v.removeEventListener("ended", handleEnded);
      v.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, []);

  const handleTogglePlayMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;

    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}

    // In Telegram, tapping video note toggles sound / play
    if (isMuted) {
      v.muted = false;
      setIsMuted(false);
      if (v.paused) {
        v.play().catch(() => {});
        setIsPlaying(true);
      }
      setShowMuteNotice(true);
      setTimeout(() => setShowMuteNotice(false), 1500);
    } else {
      if (v.paused) {
        v.play().catch(() => {});
        setIsPlaying(true);
      } else {
        v.muted = true;
        setIsMuted(true);
        setShowMuteNotice(true);
        setTimeout(() => setShowMuteNotice(false), 1500);
      }
    }
  };

  const formatSeconds = (sec: number) => {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const remainder = s % 60;
    return `${m}:${remainder < 10 ? "0" : ""}${remainder}`;
  };

  return (
    <div
      className={`circleVideoContainer ${className}`}
      onClick={handleTogglePlayMute}
      style={{
        position: "relative",
        width: "200px",
        height: "200px",
        borderRadius: "50%",
        cursor: "pointer",
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
        backgroundColor: "#000",
        margin: "4px 0",
        display: "inline-block",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      title="Ovozni yoqish / to'xtatish uchun bosing"
    >
      <video
        ref={videoRef}
        src={mediaUrl}
        autoPlay
        playsInline
        muted={isMuted}
        loop
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "50%",
          display: "block",
        }}
      />

      {/* SVG Progress Ring */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transform: "rotate(-90deg)",
          pointerEvents: "none",
        }}
        viewBox="0 0 192 192"
      >
        <circle
          stroke="rgba(255, 255, 255, 0.2)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="#f43f5e"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{
            strokeDashoffset,
            transition: "stroke-dashoffset 0.15s linear",
          }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>

      {/* Center Play/Pause Overlay if Paused */}
      {!isPlaying && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "grid",
            placeItems: "center",
            borderRadius: "50%",
          }}
        >
          <Play size={36} color="#ffffff" fill="#ffffff" />
        </div>
      )}

      {/* Sound status pill / notice */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(15, 23, 42, 0.75)",
          color: "#ffffff",
          padding: "3px 8px",
          borderRadius: "999px",
          fontSize: "10px",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: "4px",
          backdropFilter: "blur(4px)",
          pointerEvents: "none",
        }}
      >
        {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} color="#10b981" />}
        <span>{formatSeconds(currentTime)}</span>
      </div>

      {showMuteNotice && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            color: "#fff",
            borderRadius: "50%",
            width: "44px",
            height: "44px",
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            animation: "pulse 0.4s ease",
          }}
        >
          {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} color="#10b981" />}
        </div>
      )}
    </div>
  );
};

interface TelegramCircularVideoRecorderOverlayProps {
  onCancel: () => void;
  onSend: (base64Video: string, durationSec: number) => void;
  onShowToast?: (msg: string) => void;
}

export const TelegramCircularVideoRecorderOverlay: React.FC<TelegramCircularVideoRecorderOverlayProps> = ({
  onCancel,
  onSend,
  onShowToast,
}) => {
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const [recordSec, setRecordSec] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isFinishing, setIsFinishing] = useState(false);

  const MAX_RECORD_SEC = 60; // Telegram video note standard max duration: 60s
  const radius = 115;
  const stroke = 5;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = recordSec / MAX_RECORD_SEC;
  const strokeDashoffset = circumference - progress * circumference;

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
  };

  const startCameraAndRecording = async (targetFacing: "user" | "environment") => {
    stopTracks();
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: targetFacing,
            width: { ideal: 480 },
            height: { ideal: 480 },
            aspectRatio: { ideal: 1 },
          },
          audio: true,
        });
      } catch {
        // Fallback without exact constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }

      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      // Check supported MIME types for video
      let mimeType = "video/webm;codecs=vp8,opus";
      if (typeof MediaRecorder !== "undefined" && !MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }
      if (typeof MediaRecorder !== "undefined" && !MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/mp4";
      }
      if (typeof MediaRecorder !== "undefined" && !MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "";
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blobType = mimeType || "video/webm";
        const videoBlob = new Blob(chunksRef.current, { type: blobType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Video = reader.result as string;
          onSend(base64Video, recordSec || 1);
        };
        reader.readAsDataURL(videoBlob);
        stopTracks();
      };

      recorder.start(250); // Slice every 250ms
      setRecordSec(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordSec((prev) => {
          if (prev + 1 >= MAX_RECORD_SEC) {
            handleFinish();
            return MAX_RECORD_SEC;
          }
          return prev + 1;
        });
      }, 1000);

      try {
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
      } catch {}
    } catch (err) {
      console.error("Camera access failed", err);
      onShowToast?.("Kameradan foydalanishga ruxsat berilmadi yoki kamera topilmadi");
      onCancel();
    }
  };

  useEffect(() => {
    startCameraAndRecording(facingMode);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopTracks();
    };
  }, [facingMode]);

  const handleFinish = () => {
    if (isFinishing) return;
    setIsFinishing(true);
    if (timerRef.current) clearInterval(timerRef.current);

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      stopTracks();
      onCancel();
    }

    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}
  };

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      try {
        recorderRef.current.stop();
      } catch {}
    }
    stopTracks();
    onCancel();
  };

  const handleSwitchCamera = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
    } catch {}
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div
      className="chatVideoNoteRecorder"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      {/* Top Header Information */}
      <div
        style={{
          position: "absolute",
          top: "32px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "rgba(225, 29, 72, 0.2)",
          border: "1px solid rgba(225, 29, 72, 0.4)",
          padding: "6px 16px",
          borderRadius: "999px",
          color: "#fff",
          fontSize: "13px",
          fontWeight: 700,
        }}
      >
        <span
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            backgroundColor: "#ef4444",
            display: "inline-block",
            boxShadow: "0 0 10px #ef4444",
            animation: "pulse 1s infinite",
          }}
        />
        <span>Dumaloq video yozilmoqda</span>
        <span style={{ color: "#f43f5e", marginLeft: "4px" }}>{formatTimer(recordSec)}</span>
      </div>

      {/* Main Telegram Round Camera Frame */}
      <div
        style={{
          position: "relative",
          width: "240px",
          height: "240px",
          borderRadius: "50%",
          overflow: "hidden",
          backgroundColor: "#000",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8), 0 0 0 4px rgba(244, 63, 94, 0.5)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <video
          ref={videoPreviewRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
            transform: facingMode === "user" ? "scaleX(-1)" : "none",
          }}
        />

        {/* Outer Circular Timer Progress Ring */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            transform: "rotate(-90deg)",
            pointerEvents: "none",
          }}
          viewBox="0 0 230 230"
        >
          <circle
            stroke="rgba(255, 255, 255, 0.15)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke="#f43f5e"
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            style={{
              strokeDashoffset,
              transition: "stroke-dashoffset 0.5s linear",
            }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>

        {/* Camera switch button inside circle top-right */}
        <button
          type="button"
          onClick={handleSwitchCamera}
          style={{
            position: "absolute",
            top: "14px",
            right: "14px",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            backdropFilter: "blur(6px)",
            zIndex: 10,
          }}
          title="Kamerani almashtirish"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* Control Actions Bar */}
      <div
        style={{
          marginTop: "36px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        {/* Cancel Button */}
        <button
          type="button"
          onClick={handleCancel}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 20px",
            borderRadius: "999px",
            backgroundColor: "rgba(255, 255, 255, 0.12)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            color: "#f87171",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            backdropFilter: "blur(8px)",
          }}
        >
          <X size={18} />
          <span>Bekor qilish</span>
        </button>

        {/* Finish and Send Button */}
        <button
          type="button"
          onClick={handleFinish}
          disabled={isFinishing}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "14px 28px",
            borderRadius: "999px",
            backgroundColor: "#e11d48",
            border: "none",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(225, 29, 72, 0.45)",
          }}
        >
          <Check size={20} />
          <span>{isFinishing ? "Yuborilmoqda..." : "Yuborish ✓"}</span>
        </button>
      </div>

      <div style={{ marginTop: "14px", fontSize: "12px", color: "rgba(255, 255, 255, 0.65)" }}>
        Maksimal davomiylik: 60 soniya · Telegram formatidagi dumaloq video
      </div>
    </div>
  );
};
