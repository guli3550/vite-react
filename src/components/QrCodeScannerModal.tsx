import React, { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import {
  QrCode,
  RefreshCw,
  X,
  Zap,
  ZapOff,
  Image as ImageIcon,
  Lock,
  Smartphone,
  Compass,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Camera,
} from "lucide-react";
import { type Language } from "../utils/translations";
import { extractPromoFromQr } from "../utils/promoHelpers";

interface QrCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (promoCode: string) => void;
  language?: Language;
}

type BrowserGuideTab = "chrome" | "safari" | "telegram";

export const QrCodeScannerModal: React.FC<QrCodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  language = "uz",
}) => {
  const isRu = language === "ru";
  const isEn = language === "en";

  // Visual View Mode:
  // "scanning" -> active viewfinder
  // "permission_request" -> pre-flight prompt explaining why camera is needed
  // "permission_denied" -> step-by-step troubleshooting guide to unblock
  // "success" -> lock-on celebration before closing
  const [viewMode, setViewMode] = useState<
    "permission_request" | "scanning" | "permission_denied" | "success"
  >("scanning");

  const [activeGuideTab, setActiveGuideTab] = useState<BrowserGuideTab>("chrome");
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [fileErrorMsg, setFileErrorMsg] = useState<string | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);

  // Trigger feedback (haptic + chime)
  const triggerSuccessFeedback = useCallback(() => {
    try {
      (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}
    try {
      if ("vibrate" in navigator) {
        navigator.vibrate([40, 60, 80]);
      }
    } catch {}
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.15); // A6
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch {}
  }, []);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      setStream(null);
    }
    isScanningRef.current = false;
  }, [stream]);

  // Close with smooth exit transition
  const handleCloseWithAnimation = useCallback(() => {
    setIsClosing(true);
    stopCamera();
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
  }, [stopCamera, onClose]);

  const handleDetectedCode = useCallback(
    (raw: string) => {
      if (!raw || isScanningRef.current === false) return;
      isScanningRef.current = false;
      const code = extractPromoFromQr(raw);
      if (!code) return;

      setScannedCode(code);
      setViewMode("success");
      triggerSuccessFeedback();

      // Smooth visual confirmation before closing and applying
      setTimeout(() => {
        onScanSuccess(code);
        handleCloseWithAnimation();
      }, 700);
    },
    [onScanSuccess, triggerSuccessFeedback, handleCloseWithAnimation]
  );

  // Frame scanning loop
  const startScanLoop = useCallback(() => {
    let lastCheck = 0;
    const barcodeDetector: any =
      typeof window !== "undefined" && "BarcodeDetector" in window
        ? new (window as any).BarcodeDetector({ formats: ["qr_code"] })
        : null;

    const tick = async (timestamp: number) => {
      if (!isScanningRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === video.HAVE_ENOUGH_DATA && canvas) {
        if (timestamp - lastCheck > 60) {
          lastCheck = timestamp;

          // 1. Try native BarcodeDetector first (GPU accelerated)
          if (barcodeDetector) {
            try {
              const barcodes = await barcodeDetector.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleDetectedCode(barcodes[0].rawValue);
                return;
              }
            } catch {}
          }

          // 2. jsQR software fallback
          const width = video.videoWidth;
          const height = video.videoHeight;
          if (width > 0 && height > 0) {
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, width, height);
              const imageData = ctx.getImageData(0, 0, width, height);
              const qr = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
              });
              if (qr && qr.data) {
                handleDetectedCode(qr.data);
                return;
              }
            }
          }
        }
      }

      if (isScanningRef.current) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [handleDetectedCode]);

  // Request & Start Camera
  const startCamera = useCallback(async () => {
    stopCamera();
    setIsInitializing(true);
    setScannedCode(null);
    setFileErrorMsg(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsInitializing(false);
      setViewMode("permission_denied");
      return;
    }

    try {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoInputs.length > 1);
      } catch {}

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280, min: 480 },
          height: { ideal: 720, min: 480 },
        },
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        setHasTorch(Boolean(capabilities.torch));
      }

      setViewMode("scanning");

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        isScanningRef.current = true;
        setIsInitializing(false);
        startScanLoop();
      } else {
        // In case videoRef was not yet rendered
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.setAttribute("playsinline", "true");
            videoRef.current.play().then(() => {
              isScanningRef.current = true;
              setIsInitializing(false);
              startScanLoop();
            }).catch(() => {
              setIsInitializing(false);
            });
          }
        }, 150);
      }
    } catch (err: any) {
      console.warn("Camera access failed:", err);
      setIsInitializing(false);
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        err.name === "SecurityError"
      ) {
        setViewMode("permission_denied");
      } else {
        setViewMode("permission_denied");
      }
    }
  }, [facingMode, stopCamera, startScanLoop]);

  // Initial check on modal open
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setScannedCode(null);
      setFileErrorMsg(null);

      // Auto-detect user agent for guide tab
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod|safari/i.test(ua) && !/chrome|crios|crmo/i.test(ua)) {
        setActiveGuideTab("safari");
      } else if (/telegram/i.test(ua)) {
        setActiveGuideTab("telegram");
      } else {
        setActiveGuideTab("chrome");
      }

      // Check permission state if supported
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions
          .query({ name: "camera" as PermissionName })
          .then((res) => {
            if (res.state === "denied") {
              setViewMode("permission_denied");
            } else if (res.state === "granted") {
              startCamera();
            } else {
              // "prompt" -> show the friendly explanatory pre-flight dialog
              setViewMode("permission_request");
            }
          })
          .catch(() => {
            // If query fails, attempt to start camera directly
            startCamera();
          });
      } else {
        startCamera();
      }
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn("Torch toggle failed:", err);
    }
  };

  // Switch camera facing
  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Handle image upload fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    setFileErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const qr = jsQR(imageData.data, imageData.width, imageData.height);
          setIsProcessingImage(false);
          if (qr && qr.data) {
            handleDetectedCode(qr.data);
          } else {
            setFileErrorMsg(
              isRu
                ? "В выбранном фото QR-код не найден. Попробуйте четкий снимок."
                : isEn
                ? "No QR code detected in this photo. Please try a clearer image."
                : "Tanlangan rasmda QR kod topilmadi. Aniqroq rasm tanlang."
            );
          }
        }
      };
      img.onerror = () => {
        setIsProcessingImage(false);
        setFileErrorMsg(
          isRu
            ? "Ошибка чтения изображения."
            : isEn
            ? "Failed to read image file."
            : "Faylni o‘qishda xatolik yuz berdi."
        );
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Native Telegram QR scanner option
  const openTelegramNativeScanner = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.showScanQrPopup) {
      stopCamera();
      tg.showScanQrPopup(
        {
          text: isRu
            ? "Наведите камеру на QR-код с промокодом"
            : isEn
            ? "Point camera at promo QR code"
            : "Promokod QR kodini skanerlang",
        },
        (data: string) => {
          if (data) {
            handleDetectedCode(data);
            tg.closeScanQrPopup?.();
            return true;
          }
          return false;
        }
      );
    }
  };

  const hasTelegramScanner = Boolean(
    typeof window !== "undefined" && (window as any).Telegram?.WebApp?.showScanQrPopup
  );

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        backgroundColor: "rgba(8, 8, 12, 0.88)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
        opacity: isClosing ? 0 : 1,
        transition: "opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <style>{`
        @keyframes qrModalIn {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(24px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes qrLaserSweep {
          0% {
            top: 4%;
            opacity: 0.9;
          }
          50% {
            top: 92%;
            opacity: 1;
          }
          100% {
            top: 4%;
            opacity: 0.9;
          }
        }
        @keyframes qrLaserTrail {
          0% {
            top: 4%;
            opacity: 0.35;
          }
          50% {
            top: 86%;
            opacity: 0.55;
          }
          100% {
            top: 4%;
            opacity: 0.35;
          }
        }
        @keyframes qrCornerPulse {
          0%, 100% {
            border-color: #ff2a5f;
            filter: drop-shadow(0 0 6px rgba(255, 42, 95, 0.6));
          }
          50% {
            border-color: #ffffff;
            filter: drop-shadow(0 0 14px rgba(255, 42, 95, 0.95));
          }
        }
        @keyframes qrRadarPulse {
          0% {
            transform: scale(0.85);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.2;
          }
          100% {
            transform: scale(0.85);
            opacity: 0.7;
          }
        }
        @keyframes qrGridShift {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 24px 24px;
          }
        }
        @keyframes qrBadgePop {
          0% {
            transform: scale(0.6);
            opacity: 0;
          }
          60% {
            transform: scale(1.15);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>

      {/* Main Scanner Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "linear-gradient(180deg, #181822 0%, #111117 100%)",
          borderRadius: "28px",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          boxShadow: "0 28px 70px rgba(0, 0, 0, 0.75), 0 0 40px rgba(225, 29, 72, 0.15)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          animation: "qrModalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, rgba(225, 29, 72, 0.35), rgba(225, 29, 72, 0.1))",
                border: "1px solid rgba(225, 29, 72, 0.45)",
                color: "#ff4d6d",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 0 16px rgba(225, 29, 72, 0.3)",
              }}
            >
              <QrCode size={20} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 800,
                  color: "#ffffff",
                  letterSpacing: "-0.01em",
                }}
              >
                {isRu
                  ? "QR-сканер промокодов"
                  : isEn
                  ? "Promo QR Scanner"
                  : "Promokod QR skaneri"}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: "#9ca3af",
                  marginTop: "2px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: viewMode === "scanning" ? "#10b981" : "#e11d48",
                    display: "inline-block",
                  }}
                />
                {viewMode === "scanning"
                  ? isRu
                    ? "Камера активна"
                    : isEn
                    ? "Live camera active"
                    : "Kamera faol"
                  : isRu
                  ? "Автоматическое применение"
                  : isEn
                  ? "Instant discount application"
                  : "Avtomatik chegirma"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseWithAnimation}
            aria-label="Yopish"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#e5e7eb",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewport Area / Mode Switcher */}
        {viewMode === "permission_request" ? (
          /* ============================================================== */
          /* 1. ACCESS CAMERA PERMISSION REQUEST PRE-FLIGHT DIALOG          */
          /* ============================================================== */
          <div
            style={{
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: "18px",
            }}
          >
            {/* Animated Camera Permission Badge */}
            <div
              style={{
                position: "relative",
                width: "84px",
                height: "84px",
                display: "grid",
                placeItems: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(225, 29, 72, 0.28) 0%, transparent 70%)",
                  animation: "qrRadarPulse 2.8s infinite ease-in-out",
                }}
              />
              <div
                style={{
                  width: "66px",
                  height: "66px",
                  borderRadius: "22px",
                  background: "linear-gradient(135deg, rgba(225, 29, 72, 0.25), rgba(225, 29, 72, 0.08))",
                  border: "1.5px solid rgba(225, 29, 72, 0.5)",
                  color: "#ff2a5f",
                  display: "grid",
                  placeItems: "center",
                  boxShadow: "0 8px 28px rgba(225, 29, 72, 0.35)",
                }}
              >
                <Camera size={32} />
              </div>
            </div>

            <div>
              <h2
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "18px",
                  fontWeight: 850,
                  color: "#ffffff",
                  letterSpacing: "-0.02em",
                }}
              >
                {isRu
                  ? "Разрешить доступ к камере"
                  : isEn
                  ? "Allow Camera Access"
                  : "Kameraga kirishga ruxsat bering"}
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: "#9ca3af",
                  maxWidth: "340px",
                }}
              >
                {isRu
                  ? "Для мгновенного считывания промокода с чека или купона приложению требуется доступ к камере вашего устройства."
                  : isEn
                  ? "To instantly scan promo codes from cards or receipts, the app needs access to your device camera."
                  : "Chek yoki vaucherdagi promokod QR kodini 1 soniyada avtomatik o‘qish uchun kameraga ruxsat bering."}
              </p>
            </div>

            {/* Privacy & Safety Bullet Points */}
            <div
              style={{
                width: "100%",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "16px",
                padding: "14px 16px",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                boxSizing: "border-box",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <ShieldCheck size={18} color="#10b981" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span style={{ fontSize: "12px", color: "#d1d5db", lineHeight: 1.4 }}>
                  <b>{isRu ? "100% локально:" : isEn ? "100% Local:" : "100% xavfsiz:"}</b>{" "}
                  {isRu
                    ? "Изображения обрабатываются на устройстве и никуда не отправляются."
                    : isEn
                    ? "Frames are processed in real-time on your device; no video is saved."
                    : "Kamera tasvirlari faqat qurilmangizda o‘qiladi, hech qayerga saqlanmaydi."}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <CheckCircle2 size={18} color="#ff4d6d" style={{ flexShrink: 0, marginTop: "2px" }} />
                <span style={{ fontSize: "12px", color: "#d1d5db", lineHeight: 1.4 }}>
                  <b>{isRu ? "Мгновенно:" : isEn ? "Instant:" : "Tezkor:"}</b>{" "}
                  {isRu
                    ? "Скидка сразу применится к сумме вашего заказа."
                    : isEn
                    ? "The discount is instantly applied to your checkout total."
                    : "Chegirma to‘g‘ridan-to‘g‘ri buyurtma hisobiga o‘tadi."}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={startCamera}
                disabled={isInitializing}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: "16px",
                  background: "var(--primary-gradient, linear-gradient(135deg, #e11d48, #be123c))",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 8px 24px rgba(225, 29, 72, 0.4)",
                  transition: "all 0.2s ease",
                }}
              >
                {isInitializing ? (
                  <span>{isRu ? "Запуск камеры…" : isEn ? "Opening camera…" : "Kamera ochilmoqda…"}</span>
                ) : (
                  <>
                    <Camera size={18} />
                    <span>
                      {isRu
                        ? "Открыть камеру"
                        : isEn
                        ? "Open Camera & Scan"
                        : "Kamerani ochish"}
                    </span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: "100%",
                  padding: "11px 16px",
                  borderRadius: "14px",
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#e5e7eb",
                  fontSize: "12.5px",
                  fontWeight: 750,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <ImageIcon size={16} />
                <span>{isRu ? "Или выбрать фото из галереи" : isEn ? "Or choose QR image from gallery" : "Yoki galereyadan rasm tanlash"}</span>
              </button>
            </div>
          </div>
        ) : viewMode === "permission_denied" ? (
          /* ============================================================== */
          /* 2. CAMERA PERMISSION DENIED - STEP-BY-STEP USER GUIDE          */
          /* ============================================================== */
          <div
            style={{
              padding: "22px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* Header Alert */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "14px",
                  background: "rgba(244, 63, 94, 0.16)",
                  border: "1px solid rgba(244, 63, 94, 0.35)",
                  color: "#fb7185",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <Lock size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#ffffff" }}>
                  {isRu
                    ? "Доступ к камере заблокирован"
                    : isEn
                    ? "Camera Access is Blocked"
                    : "Kameraga ruxsat bloklangan"}
                </h3>
                <p style={{ margin: 0, fontSize: "11.5px", color: "#9ca3af", marginTop: "2px" }}>
                  {isRu
                    ? "Следуйте инструкции ниже, чтобы включить"
                    : isEn
                    ? "Follow steps below to enable permission"
                    : "Quyidagi ko‘rsatma orqali ruxsat bering"}
                </p>
              </div>
            </div>

            {/* Browser Selector Tabs */}
            <div
              style={{
                display: "flex",
                background: "rgba(255, 255, 255, 0.05)",
                padding: "4px",
                borderRadius: "14px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                gap: "4px",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveGuideTab("chrome")}
                style={{
                  flex: 1,
                  padding: "8px 6px",
                  borderRadius: "10px",
                  border: "none",
                  background: activeGuideTab === "chrome" ? "rgba(225, 29, 72, 0.25)" : "transparent",
                  color: activeGuideTab === "chrome" ? "#ffffff" : "#9ca3af",
                  fontWeight: 750,
                  fontSize: "11.5px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                }}
              >
                <Smartphone size={14} />
                <span>Chrome / Android</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab("safari")}
                style={{
                  flex: 1,
                  padding: "8px 6px",
                  borderRadius: "10px",
                  border: "none",
                  background: activeGuideTab === "safari" ? "rgba(225, 29, 72, 0.25)" : "transparent",
                  color: activeGuideTab === "safari" ? "#ffffff" : "#9ca3af",
                  fontWeight: 750,
                  fontSize: "11.5px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                }}
              >
                <Compass size={14} />
                <span>Safari / iOS</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveGuideTab("telegram")}
                style={{
                  flex: 1,
                  padding: "8px 6px",
                  borderRadius: "10px",
                  border: "none",
                  background: activeGuideTab === "telegram" ? "rgba(225, 29, 72, 0.25)" : "transparent",
                  color: activeGuideTab === "telegram" ? "#ffffff" : "#9ca3af",
                  fontWeight: 750,
                  fontSize: "11.5px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                }}
              >
                <span>✈️</span>
                <span>Telegram</span>
              </button>
            </div>

            {/* Step-by-Step Instructions Container */}
            <div
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "18px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {activeGuideTab === "chrome" && (
                <>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "#e11d48",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      1
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#e5e7eb", lineHeight: 1.45 }}>
                      {isRu
                        ? "Нажмите на значок 🔒 (или настройки сайта) слева от адресной строки браузера."
                        : isEn
                        ? "Tap the 🔒 lock icon (or site settings) on the left side of the address bar."
                        : "Brauzer manzil qatorining chap tomonidagi 🔒 qulf belgisini bosing."}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "#e11d48",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      2
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#e5e7eb", lineHeight: 1.45 }}>
                      {isRu
                        ? "Найдите пункт «Камера» и переключите в положение «Разрешить»."
                        : isEn
                        ? "Find «Camera» setting and toggle it to «Allow»."
                        : "«Kamera» bo‘limini tanlang va «Ruxsat berish» (Allow) holatiga o‘tkazing."}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "#e11d48",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      3
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#e5e7eb", lineHeight: 1.45 }}>
                      {isRu
                        ? "Нажмите кнопку «Повторить» ниже."
                        : isEn
                        ? "Click the «Retry» button below."
                        : "Quyidagi «Qayta tekshirish» tugmasini bosing."}
                    </span>
                  </div>
                </>
              )}

              {activeGuideTab === "safari" && (
                <>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "#e11d48",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      1
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#e5e7eb", lineHeight: 1.45 }}>
                      {isRu
                        ? "Нажмите значок «aA» или 🔒 в адресной строке Safari."
                        : isEn
                        ? "Tap the «aA» or 🔒 icon in the Safari address bar."
                        : "Safari manzil qatoridagi «aA» yoki 🔒 belgisini bosing."}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "#e11d48",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      2
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#e5e7eb", lineHeight: 1.45 }}>
                      {isRu
                        ? "Выберите «Настройки веб-сайта» → «Камера» → «Разрешить»."
                        : isEn
                        ? "Select «Website Settings» → «Camera» → «Allow»."
                        : "«Veb-sayt sozlamalari» → «Kamera» → «Ruxsat berish» ni tanlang."}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "#e11d48",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      3
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#e5e7eb", lineHeight: 1.45 }}>
                      {isRu
                        ? "Вернитесь на страницу и нажмите «Повторить»."
                        : isEn
                        ? "Return and tap «Retry» below."
                        : "Ilovaga qaytib, «Qayta tekshirish» tugmasini bosing."}
                    </span>
                  </div>
                </>
              )}

              {activeGuideTab === "telegram" && (
                <>
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "#e11d48",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      1
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#e5e7eb", lineHeight: 1.45 }}>
                      {isRu
                        ? "В приложении Telegram откройте Настройки устройства → Telegram → включите «Камера»."
                        : isEn
                        ? "In device Settings → open Telegram → enable «Camera» permission."
                        : "Qurilmangiz Sozlamalari → Telegram ilovasi → «Kamera» ruxsatini yoqing."}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: "#e11d48",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "11px",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      2
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#e5e7eb", lineHeight: 1.45 }}>
                      {isRu
                        ? "Или нажмите «Telegram сканер» ниже для встроенного системного сканера."
                        : isEn
                        ? "Or use the native Telegram scanner button below."
                        : "Yoki pastdagi «Telegram skaner» tugmasi orqali skanerlang."}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Troubleshooting Action Buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={startCamera}
                disabled={isInitializing}
                style={{
                  flex: 1.3,
                  padding: "13px 16px",
                  borderRadius: "15px",
                  background: "var(--primary-gradient, linear-gradient(135deg, #e11d48, #be123c))",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "7px",
                  boxShadow: "0 6px 20px rgba(225, 29, 72, 0.4)",
                }}
              >
                <RefreshCw size={15} />
                <span>{isRu ? "Повторить проверку" : isEn ? "Retry Camera" : "Qayta tekshirish"}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1,
                  padding: "13px 14px",
                  borderRadius: "15px",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  fontSize: "12.5px",
                  fontWeight: 750,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <ImageIcon size={15} />
                <span>{isRu ? "Фото из галереи" : isEn ? "Pick Image" : "Rasmdan tanlash"}</span>
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* 3. ACTIVE CAMERA SCANNER VIEWPORT & ANIMATED RETICLE          */
          /* ============================================================== */
          <>
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "340px",
                backgroundColor: "#07070a",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Hidden Canvas for decoding */}
              <canvas ref={canvasRef} style={{ display: "none" }} />

              {/* Video Element */}
              <video
                ref={videoRef}
                playsInline
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: facingMode === "user" ? "scaleX(-1)" : "none",
                }}
              />

              {/* Camera Starting Spinner */}
              {isInitializing && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    background: "rgba(10, 10, 14, 0.88)",
                    color: "#e5e7eb",
                    zIndex: 10,
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      border: "3px solid rgba(225, 29, 72, 0.25)",
                      borderTopColor: "#e11d48",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  <span style={{ fontSize: "12.5px", fontWeight: 700 }}>
                    {isRu ? "Фокусировка камеры…" : isEn ? "Initializing camera…" : "Kamera fokuslanmoqda…"}
                  </span>
                </div>
              )}

              {/* Futuristic Viewfinder Reticle & AR Scanning Overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Dark Outer Mask */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "radial-gradient(circle at center, transparent 100px, rgba(0, 0, 0, 0.72) 230px)",
                  }}
                />

                {/* Concentric Radar Rings */}
                <div
                  style={{
                    position: "absolute",
                    width: "250px",
                    height: "250px",
                    borderRadius: "50%",
                    border: "1px dashed rgba(225, 29, 72, 0.22)",
                    animation: "qrRadarPulse 3.5s infinite ease-in-out",
                  }}
                />

                {/* Central Targeting Frame */}
                <div
                  style={{
                    position: "relative",
                    width: "220px",
                    height: "220px",
                    borderRadius: "24px",
                    border: "1px solid rgba(255, 255, 255, 0.22)",
                    boxShadow: "0 0 25px rgba(225, 29, 72, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.6)",
                    overflow: "hidden",
                  }}
                >
                  {/* Subtle Tech Grid inside reticle */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage: `
                        linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
                      `,
                      backgroundSize: "22px 22px",
                      opacity: 0.75,
                      animation: "qrGridShift 12s linear infinite",
                    }}
                  />

                  {/* 4 Neon Pulsing Corner Brackets */}
                  {/* Top-Left */}
                  <div
                    style={{
                      position: "absolute",
                      top: "-2px",
                      left: "-2px",
                      width: "30px",
                      height: "30px",
                      borderTop: "4px solid #ff2a5f",
                      borderLeft: "4px solid #ff2a5f",
                      borderTopLeftRadius: "18px",
                      animation: "qrCornerPulse 2.4s infinite ease-in-out",
                    }}
                  />
                  {/* Top-Right */}
                  <div
                    style={{
                      position: "absolute",
                      top: "-2px",
                      right: "-2px",
                      width: "30px",
                      height: "30px",
                      borderTop: "4px solid #ff2a5f",
                      borderRight: "4px solid #ff2a5f",
                      borderTopRightRadius: "18px",
                      animation: "qrCornerPulse 2.4s infinite ease-in-out",
                    }}
                  />
                  {/* Bottom-Left */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      left: "-2px",
                      width: "30px",
                      height: "30px",
                      borderBottom: "4px solid #ff2a5f",
                      borderLeft: "4px solid #ff2a5f",
                      borderBottomLeftRadius: "18px",
                      animation: "qrCornerPulse 2.4s infinite ease-in-out",
                    }}
                  />
                  {/* Bottom-Right */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      right: "-2px",
                      width: "30px",
                      height: "30px",
                      borderBottom: "4px solid #ff2a5f",
                      borderRight: "4px solid #ff2a5f",
                      borderBottomRightRadius: "18px",
                      animation: "qrCornerPulse 2.4s infinite ease-in-out",
                    }}
                  />

                  {/* Center Guidance Crosshairs */}
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      width: "16px",
                      height: "16px",
                      transform: "translate(-50%, -50%)",
                      pointerEvents: "none",
                      opacity: 0.65,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "7px",
                        left: 0,
                        right: 0,
                        height: "1px",
                        background: "#ff2a5f",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: "7px",
                        top: 0,
                        bottom: 0,
                        width: "1px",
                        background: "#ff2a5f",
                      }}
                    />
                  </div>

                  {/* Laser Beam Trail (Glow aura) */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      height: "34px",
                      background: "linear-gradient(180deg, rgba(255, 42, 95, 0.28) 0%, transparent 100%)",
                      animation: "qrLaserTrail 2.2s infinite ease-in-out",
                      pointerEvents: "none",
                    }}
                  />

                  {/* High-intensity Laser Beam Line */}
                  <div
                    style={{
                      position: "absolute",
                      left: "3%",
                      right: "3%",
                      height: "3px",
                      background: "linear-gradient(90deg, transparent, #ff2a5f, #ffffff, #ff2a5f, transparent)",
                      boxShadow: "0 0 16px #ff2a5f, 0 0 6px #ffffff",
                      animation: "qrLaserSweep 2.2s infinite ease-in-out",
                      pointerEvents: "none",
                    }}
                  />
                </div>

                {/* Success Recognition Pop Flash */}
                {viewMode === "success" && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundColor: "rgba(16, 185, 129, 0.42)",
                      backdropFilter: "blur(6px)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "10px",
                      zIndex: 30,
                    }}
                  >
                    <div
                      style={{
                        width: "68px",
                        height: "68px",
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        color: "#ffffff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "34px",
                        fontWeight: 900,
                        boxShadow: "0 10px 30px rgba(16, 185, 129, 0.7)",
                        animation: "qrBadgePop 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    >
                      ✓
                    </div>
                    <span
                      style={{
                        background: "rgba(0, 0, 0, 0.88)",
                        border: "1px solid rgba(16, 185, 129, 0.6)",
                        color: "#ffffff",
                        padding: "7px 18px",
                        borderRadius: "14px",
                        fontSize: "15px",
                        fontWeight: 850,
                        letterSpacing: "0.6px",
                      }}
                    >
                      {scannedCode}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Error message from file upload if any */}
            {fileErrorMsg && (
              <div
                style={{
                  padding: "9px 16px",
                  background: "rgba(225, 29, 72, 0.14)",
                  borderTop: "1px solid rgba(225, 29, 72, 0.25)",
                  color: "#ff4d6d",
                  fontSize: "11.5px",
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                ⚠️ {fileErrorMsg}
              </div>
            )}

            {/* Viewfinder Instructions Banner */}
            <div
              style={{
                padding: "12px 18px",
                background: "rgba(255, 255, 255, 0.03)",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                textAlign: "center",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  color: "#d1d5db",
                  fontWeight: 650,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "7px",
                }}
              >
                <span>🎯</span>
                {isRu
                  ? "Наведите рамку на QR-код купона — промокод считается сразу"
                  : isEn
                  ? "Align frame with promo QR code — it applies immediately"
                  : "Kupon QR kodini ramkaga to‘g‘rilang — u darhol qo‘llanadi"}
              </span>
            </div>

            {/* Controls Toolbar (Torch, Flip, Gallery, Native TG) */}
            <div
              style={{
                padding: "14px 18px",
                background: "rgba(0, 0, 0, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              {/* Torch toggle button */}
              <button
                type="button"
                onClick={toggleTorch}
                disabled={!hasTorch}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  borderRadius: "14px",
                  background: torchOn ? "rgba(234, 179, 8, 0.22)" : "rgba(255, 255, 255, 0.07)",
                  border: torchOn ? "1px solid rgba(234, 179, 8, 0.55)" : "1px solid rgba(255, 255, 255, 0.1)",
                  color: torchOn ? "#fbbf24" : hasTorch ? "#e5e7eb" : "#6b7280",
                  fontSize: "11.5px",
                  fontWeight: 750,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  cursor: hasTorch ? "pointer" : "not-allowed",
                  transition: "all 0.18s ease",
                }}
              >
                {torchOn ? <Zap size={16} /> : <ZapOff size={16} />}
                <span>{isRu ? "Фонарик" : isEn ? "Torch" : "Chiroq"}</span>
              </button>

              {/* Flip camera */}
              {hasMultipleCameras && (
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  style={{
                    flex: 1,
                    padding: "10px 8px",
                    borderRadius: "14px",
                    background: "rgba(255, 255, 255, 0.07)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    color: "#e5e7eb",
                    fontSize: "11.5px",
                    fontWeight: 750,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                  }}
                >
                  <RefreshCw size={15} />
                  <span>{isRu ? "Камера" : isEn ? "Flip" : "Kamera"}</span>
                </button>
              )}

              {/* Upload image fallback */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  borderRadius: "14px",
                  background: "rgba(255, 255, 255, 0.07)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#e5e7eb",
                  fontSize: "11.5px",
                  fontWeight: 750,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  cursor: "pointer",
                  transition: "all 0.18s ease",
                }}
              >
                <ImageIcon size={16} />
                <span>{isProcessingImage ? "..." : isRu ? "Галерея" : isEn ? "Gallery" : "Galereya"}</span>
              </button>

              {/* Telegram scanner if present */}
              {hasTelegramScanner && (
                <button
                  type="button"
                  onClick={openTelegramNativeScanner}
                  style={{
                    flex: 1.1,
                    padding: "10px 8px",
                    borderRadius: "14px",
                    background: "linear-gradient(135deg, #0088cc, #0077b5)",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "11.5px",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    cursor: "pointer",
                    boxShadow: "0 2px 10px rgba(0, 136, 204, 0.4)",
                  }}
                >
                  <span>✈️</span>
                  <span>Telegram</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
};
