import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import jsQR from "jsqr";
import {
  QrCode,
  RefreshCw,
  X,
  Zap,
  ZapOff,
  Image as ImageIcon,
  Camera,
  Check,
  Send,
} from "lucide-react";
import { type Language } from "../utils/translations";
import { extractPromoFromQr } from "../utils/promoHelpers";

interface QrCodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (promoCode: string) => void;
  language?: Language;
}

export const QrCodeScannerModal: React.FC<QrCodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  language = "uz",
}) => {
  const isRu = language === "ru";
  const isEn = language === "en";

  const [viewMode, setViewMode] = useState<
    "permission_request" | "scanning" | "permission_denied" | "success"
  >("scanning");
  const [isClosing, setIsClosing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef(false);

  const [isInitializing, setIsInitializing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchHint, setTorchHint] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [fileErrorMsg, setFileErrorMsg] = useState<string | null>(null);

  const triggerSuccessFeedback = useCallback(() => {
    try {
      (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}
    try {
      if ("vibrate" in navigator) navigator.vibrate([35, 50, 70]);
    } catch {}
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1560, audioCtx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch {}
  }, []);

  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    isScanningRef.current = false;
    const activeStream = streamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        try {
          if (track.kind === "video" && (track as any).applyConstraints) {
            (track as any).applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
          }
        } catch {}
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  const handleCloseWithAnimation = useCallback(() => {
    setIsClosing(true);
    stopCamera();
    window.setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  }, [stopCamera, onClose]);

  const handleDetectedCode = useCallback(
    (raw: string) => {
      if (!raw || !isScanningRef.current) return;
      const code = extractPromoFromQr(raw);
      if (!code) return;
      isScanningRef.current = false;

      setScannedCode(code);
      setViewMode("success");
      triggerSuccessFeedback();

      window.setTimeout(() => {
        onScanSuccess(code);
        handleCloseWithAnimation();
      }, 620);
    },
    [onScanSuccess, triggerSuccessFeedback, handleCloseWithAnimation],
  );

  // Optimized center-ROI scanner loop
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
        if (timestamp - lastCheck > 85) {
          lastCheck = timestamp;

          if (barcodeDetector) {
            try {
              const barcodes = await barcodeDetector.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                handleDetectedCode(barcodes[0].rawValue);
                return;
              }
            } catch {}
          }

          // Crop center square region down to <= 400px for low CPU/battery load
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (vw > 0 && vh > 0) {
            const side = Math.min(vw, vh);
            const sx = Math.floor((vw - side) / 2);
            const sy = Math.floor((vh - side) / 2);
            const targetSize = Math.min(400, side);

            canvas.width = targetSize;
            canvas.height = targetSize;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, sx, sy, side, side, 0, 0, targetSize, targetSize);
              const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
              const qr = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "attemptBoth",
              });
              if (qr?.data) {
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

  const startCamera = useCallback(async () => {
    stopCamera();
    setIsInitializing(true);
    setScannedCode(null);
    setFileErrorMsg(null);
    setTorchHint(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsInitializing(false);
      setViewMode("permission_denied");
      return;
    }

    try {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCameras(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch {}

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280, min: 480 },
          height: { ideal: 720, min: 480 },
        },
      });
      streamRef.current = mediaStream;

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack?.getCapabilities) {
        const capabilities: any = videoTrack.getCapabilities();
        setHasTorch(Boolean(capabilities?.torch));
      }

      setViewMode("scanning");

      const attachStream = () => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current
          .play()
          .then(() => {
            isScanningRef.current = true;
            setIsInitializing(false);
            startScanLoop();
          })
          .catch(() => {
            setIsInitializing(false);
          });
      };

      if (videoRef.current) {
        attachStream();
      } else {
        window.setTimeout(attachStream, 80);
      }
    } catch {
      setIsInitializing(false);
      setViewMode("permission_denied");
    }
  }, [facingMode, stopCamera, startScanLoop]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    setIsClosing(false);
    setScannedCode(null);
    setFileErrorMsg(null);
    setTorchHint(null);

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "camera" as PermissionName })
        .then((res) => {
          if (res.state === "denied") {
            setViewMode("permission_denied");
          } else if (res.state === "granted") {
            startCamera();
          } else {
            setViewMode("permission_request");
          }
        })
        .catch(() => startCamera());
    } else {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const toggleTorch = async () => {
    const activeStream = streamRef.current;
    const track = activeStream?.getVideoTracks()[0];
    if (!track || !hasTorch) {
      setTorchHint(
        isRu
          ? "Фонарик недоступен"
          : isEn
          ? "Flashlight unavailable"
          : "Bu qurilmada fanar mavjud emas",
      );
      window.setTimeout(() => setTorchHint(null), 2000);
      return;
    }

    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch {
      setTorchHint(
        isRu
          ? "Не удалось включить фонарик"
          : isEn
          ? "Could not toggle flashlight"
          : "Fanarni yoqib bo‘lmadi",
      );
      window.setTimeout(() => setTorchHint(null), 2000);
    }
  };

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
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });
          setIsProcessingImage(false);
          if (qr?.data) {
            isScanningRef.current = true;
            handleDetectedCode(qr.data);
          } else {
            setFileErrorMsg(
              isRu
                ? "QR-код не найден"
                : isEn
                ? "No QR code found"
                : "Rasmda QR kod topilmadi",
            );
          }
        }
      };
      img.onerror = () => {
        setIsProcessingImage(false);
        setFileErrorMsg(
          isRu ? "Ошибка чтения файла" : isEn ? "Image read error" : "Rasm o‘qilmadi",
        );
      };
      img.src = String(event.target?.result || "");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const openTelegramNativeScanner = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.showScanQrPopup) {
      stopCamera();
      tg.showScanQrPopup(
        {
          text: isRu
            ? "Наведите на QR-код"
            : isEn
            ? "Point at QR code"
            : "Promokod QR kodini skanerlang",
        },
        (data: string) => {
          if (data) {
            isScanningRef.current = true;
            handleDetectedCode(data);
            tg.closeScanQrPopup?.();
            return true;
          }
          return false;
        },
      );
    }
  };

  const hasTelegramScanner = Boolean(
    typeof window !== "undefined" && (window as any).Telegram?.WebApp?.showScanQrPopup,
  );

  if (!isOpen && !isClosing) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isRu ? "QR-сканер" : isEn ? "QR Scanner" : "Promokod QR skaneri"}
      className={`guliQrFullscreen ${isClosing ? "isClosing" : ""}`}
    >
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Top Floating Bar */}
      <header className="guliQrTopbar">
        <div className="guliQrBrand">
          <span className="guliQrBrandIcon" aria-hidden="true">
            <QrCode size={18} />
          </span>
          <strong className="guliQrTitle">
            {isRu ? "QR-сканер" : isEn ? "QR Scanner" : "Promokod QR skaneri"}
          </strong>
        </div>

        <div className="guliQrTopActions">
          <button
            type="button"
            className="guliQrIconBtn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingImage}
            title={isRu ? "Из галереи" : isEn ? "From gallery" : "Galereyadan tanlash"}
            aria-label={isRu ? "Из галереи" : isEn ? "From gallery" : "Galereyadan tanlash"}
          >
            <ImageIcon size={18} />
          </button>

          {viewMode === "scanning" && hasMultipleCameras && (
            <button
              type="button"
              className="guliQrIconBtn"
              onClick={() =>
                setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
              }
              title={isRu ? "Сменить камеру" : isEn ? "Switch camera" : "Kamerani almashtirish"}
              aria-label={isRu ? "Сменить камеру" : isEn ? "Switch camera" : "Kamerani almashtirish"}
            >
              <RefreshCw size={17} />
            </button>
          )}

          {hasTelegramScanner && (
            <button
              type="button"
              className="guliQrIconBtn"
              onClick={openTelegramNativeScanner}
              title="Telegram QR"
              aria-label="Telegram QR"
            >
              <Send size={16} />
            </button>
          )}

          <button
            type="button"
            className="guliQrIconBtn guliQrCloseBtn"
            onClick={handleCloseWithAnimation}
            aria-label={isRu ? "Закрыть" : isEn ? "Close" : "Yopish"}
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Permission Request / Blocked Cards */}
      {viewMode === "permission_request" || viewMode === "permission_denied" ? (
        <div className="guliQrCenterCardWrap">
          <div className="guliQrPromptCard">
            <div className="guliQrPromptIcon" aria-hidden="true">
              <Camera size={28} />
            </div>
            <h2>
              {viewMode === "permission_denied"
                ? isRu
                  ? "Нет доступа к камере"
                  : isEn
                  ? "Camera access blocked"
                  : "Kamera ruxsati yopiq"
                : isRu
                ? "Доступ к камере"
                : isEn
                ? "Allow camera"
                : "Kameraga ruxsat"}
            </h2>
            <p>
              {viewMode === "permission_denied"
                ? isRu
                  ? "Включите камеру в настройках браузера или выберите фото QR-кода."
                  : isEn
                  ? "Enable camera in browser settings or upload a QR photo."
                  : "Brauzer sozlamalaridan kameraga ruxsat bering yoki rasmdan tanlang."
                : isRu
                ? "Наведите камеру на QR-код для применения скидки."
                : isEn
                ? "Scan a Guli Market QR voucher to apply your discount."
                : "Chegirmani qo‘llash uchun QR kodni skanerlang."}
            </p>

            {fileErrorMsg && <div className="guliQrInlineAlert">{fileErrorMsg}</div>}

            <div className="guliQrPromptActions">
              <button
                type="button"
                className="guliQrPrimaryBtn"
                onClick={startCamera}
                disabled={isInitializing}
              >
                <Camera size={17} />
                <span>
                  {isInitializing
                    ? isRu
                      ? "Открытие…"
                      : isEn
                      ? "Opening…"
                      : "Ochilmoqda…"
                    : viewMode === "permission_denied"
                    ? isRu
                      ? "Повторить"
                      : isEn
                      ? "Retry"
                      : "Qayta urinish"
                    : isRu
                    ? "Открыть камеру"
                    : isEn
                    ? "Open camera"
                    : "Kamerani ochish"}
                </span>
              </button>

              <button
                type="button"
                className="guliQrSecondaryBtn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
              >
                <ImageIcon size={17} />
                <span>
                  {isRu ? "Выбрать фото" : isEn ? "Choose photo" : "Galereyadan tanlash"}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Full-Screen Active Camera Stage */
        <div className="guliQrStage">
          <video ref={videoRef} playsInline muted className="guliQrVideo" />

          {isInitializing && (
            <div className="guliQrInitOverlay">
              <div className="guliQrSpinner" />
            </div>
          )}

          {/* Centered Square Cutout & Middle Guidance Copy */}
          <div className="guliQrCenterRegion" aria-hidden="true">
            <div className={`guliQrSquareBox ${viewMode === "success" ? "isSuccess" : ""}`}>
              <span className="guliQrCorner tl" />
              <span className="guliQrCorner tr" />
              <span className="guliQrCorner bl" />
              <span className="guliQrCorner br" />
              {viewMode === "scanning" && <div className="guliQrScanBeam" />}
              {viewMode === "success" && (
                <div className="guliQrSuccessOverlay">
                  <div className="guliQrSuccessCircle">
                    <Check size={28} strokeWidth={3} />
                  </div>
                  <strong>{scannedCode}</strong>
                </div>
              )}
            </div>

            <div className="guliQrMiddleCaption">
              <p className="guliQrCaptionTitle">
                {viewMode === "success"
                  ? isRu
                    ? "Промокод найден"
                    : isEn
                    ? "Promo code detected"
                    : "Promokod topildi"
                  : isRu
                  ? "Поместите QR-код в квадрат"
                  : isEn
                  ? "Place QR code inside square"
                  : "QR kodni kvadrat ichiga joylang"}
              </p>
              <span className="guliQrCaptionSub">
                {isRu
                  ? "Скидка применится автоматически"
                  : isEn
                  ? "Discount applies automatically"
                  : "Chegirma avtomatik qo‘llanadi"}
              </span>
            </div>

            {(fileErrorMsg || torchHint) && (
              <div className="guliQrFloatingToast">{fileErrorMsg || torchHint}</div>
            )}
          </div>

          {/* Bottom-most Center Flashlight Toggle */}
          <div className="guliQrBottomBar">
            <button
              type="button"
              className={`guliQrTorchBtn ${torchOn ? "isOn" : ""} ${!hasTorch ? "isUnavailable" : ""}`}
              onClick={toggleTorch}
              aria-pressed={torchOn}
              aria-label={isRu ? "Фонарик" : isEn ? "Flashlight" : "Fanar"}
            >
              {torchOn ? <Zap size={22} /> : <ZapOff size={22} />}
            </button>
            <span className="guliQrTorchLabel">
              {torchOn
                ? isRu
                  ? "Фонарик вкл."
                  : isEn
                  ? "Flash On"
                  : "Fanar yoniq"
                : isRu
                ? "Фонарик"
                : isEn
                ? "Flashlight"
                : "Fanar"}
            </span>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        style={{ display: "none" }}
      />
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
};

export default QrCodeScannerModal;
