import React, { useRef, useState } from "react";
import jsQR from "jsqr";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Search,
  Upload,
  X,
  Edit3,
  Plus,
} from "lucide-react";
import {
  extractAndNormalizePromoCode,
  validateScannedPromoCode,
  type ValidatedPromoResult,
} from "../../utils/qrPromoValidator";
import { QrCodeScannerModal } from "../../components/QrCodeScannerModal";
import type { PromoRecord } from "./AdminQrPromoModal";

interface AdminQrScannerPanelProps {
  apiBase: string;
  promos: PromoRecord[];
  onApplyScannedFilter: (code: string, kind: "promo" | "qr") => void;
  onEditMatchedPromo: (promo: PromoRecord) => void;
  onCreateQrFromCode: (code: string) => void;
  onNotify: (msg: string) => void;
}

export const AdminQrScannerPanel: React.FC<AdminQrScannerPanelProps> = ({
  apiBase,
  promos,
  onApplyScannedFilter,
  onEditMatchedPromo,
  onCreateQrFromCode,
  onNotify,
}) => {
  const [rawInput, setRawInput] = useState("");
  const [testSubtotal, setTestSubtotal] = useState("200000");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [lastResult, setLastResult] = useState<ValidatedPromoResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const matchedPromo = lastResult?.code
    ? promos.find(
        (p) => String(p.code || "").trim().toUpperCase() === lastResult.code,
      )
    : undefined;

  const runExtractionAndValidation = async (payload: string) => {
    const cleanCode = extractAndNormalizePromoCode(payload);
    setRawInput(cleanCode || payload);
    if (!cleanCode) {
      setLastResult({
        ok: false,
        code: "",
        discount: 0,
        message: "QR koddan yaroqli promokod aniqlanmadi",
      });
      onNotify("QR koddan promokod topilmadi");
      return;
    }

    setValidating(true);
    try {
      const subtotalNum = Math.max(0, Number(testSubtotal) || 0);
      const result = await validateScannedPromoCode(payload, {
        apiBase,
        subtotal: subtotalNum,
        source: "auto",
      });
      setLastResult(result);

      const localMatch = promos.find(
        (p) => String(p.code || "").trim().toUpperCase() === result.code,
      );
      const targetKind: "promo" | "qr" =
        result.promo_kind ||
        (localMatch?.promo_kind === "qr" ? "qr" : "promo");

      onApplyScannedFilter(result.code, targetKind);

      if (result.ok) {
        onNotify(
          `✓ ${result.code} tasdiqlandi: −${Math.round(result.discount).toLocaleString("uz-UZ")} so‘m`,
        );
      } else {
        onNotify(result.message || `${result.code} tekshiruvdan o‘tmadi`);
      }
    } finally {
      setValidating(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        });
        if (decoded?.data) {
          void runExtractionAndValidation(decoded.data);
        } else {
          onNotify("Rasmda QR kod topilmadi");
        }
      };
      img.onerror = () => onNotify("Rasmni o‘qishda xatolik");
      img.src = String(ev.target?.result || "");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="adminQrScannerBox">
      <div className="adminQrScannerHead">
        <div className="adminQrScannerTitleRow">
          <span className="adminQrScannerBadge" aria-hidden="true">
            <QrCode size={18} />
          </span>
          <div>
            <strong>QR skaner va tekshiruv paneli</strong>
            <small>
              QR kodni skanerlang yoki URL/kod kiriting — mijoz chekauti bilan bir xil tekshiruv ishlaydi
            </small>
          </div>
        </div>

        <div className="adminQrScannerBtnGroup">
          <button
            type="button"
            className="adminQrCameraOpenBtn"
            onClick={() => setIsCameraOpen(true)}
          >
            <Camera size={15} />
            <span>Kamera bilan skanerlash</span>
          </button>
          <button
            type="button"
            className="adminQrSecBtn"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
            <span>Rasmdan</span>
          </button>
        </div>
      </div>

      <form
        className="adminQrScannerForm"
        onSubmit={(e) => {
          e.preventDefault();
          void runExtractionAndValidation(rawInput);
        }}
      >
        <div className="adminQrInputGroup">
          <input
            type="text"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="QR havola yoki kod: https://gulii.uz/?promo=GULIQR-..."
            aria-label="QR payload yoki promokod"
          />
          {rawInput && (
            <button
              type="button"
              className="adminQrClearInputBtn"
              onClick={() => {
                setRawInput("");
                setLastResult(null);
              }}
              aria-label="Tozalash"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <label className="adminQrSubtotalInput">
          <span>Savat summasi (so‘m)</span>
          <input
            type="number"
            min="0"
            step="1000"
            value={testSubtotal}
            onChange={(e) => setTestSubtotal(e.target.value)}
          />
        </label>

        <button
          type="submit"
          className="proPrimary adminQrVerifyBtn"
          disabled={validating || !rawInput.trim()}
        >
          <Search size={14} />
          <span>{validating ? "Tekshirilmoqda…" : "Tekshirish"}</span>
        </button>
      </form>

      {lastResult && (
        <div
          className={`adminQrScanResult ${lastResult.ok ? "isValid" : "isInvalid"}`}
        >
          <div className="adminQrScanResultInfo">
            {lastResult.ok ? (
              <CheckCircle2 size={18} className="adminQrResultIcon" />
            ) : (
              <AlertCircle size={18} className="adminQrResultIcon" />
            )}
            <div>
              <div className="adminQrResultTitle">
                <b>{lastResult.code || "Noma’lum kod"}</b>
                {lastResult.promo_kind && (
                  <span className="adminQrKindTag">
                    {lastResult.promo_kind === "qr" ? "QR Vaucher" : "Oddiy Promokod"}
                  </span>
                )}
              </div>
              <small>
                {lastResult.ok
                  ? `Chegirma: −${Math.round(lastResult.discount).toLocaleString("uz-UZ")} so‘m (${
                      lastResult.discount_type === "percent"
                        ? `${lastResult.discount_value}%`
                        : `${Math.round(lastResult.discount_value || 0).toLocaleString("uz-UZ")} so‘m`
                    }${lastResult.is_limit_applied && lastResult.max_discount_amount ? ` · maks. ${Math.round(lastResult.max_discount_amount).toLocaleString("uz-UZ")} so‘m` : ""})`
                  : lastResult.message || "Kod topilmadi yoki faol emas"}
              </small>
            </div>
          </div>

          <div className="adminQrScanResultActions">
            {matchedPromo ? (
              <button
                type="button"
                className="adminQrSecBtn"
                onClick={() => onEditMatchedPromo(matchedPromo)}
              >
                <Edit3 size={14} />
                <span>Tahrirlash</span>
              </button>
            ) : lastResult.code ? (
              <button
                type="button"
                className="adminQrSecBtn"
                onClick={() => onCreateQrFromCode(lastResult.code)}
              >
                <Plus size={14} />
                <span>QR yaratish</span>
              </button>
            ) : null}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: "none" }}
      />

      <QrCodeScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScanSuccess={(scanned) => {
          void runExtractionAndValidation(scanned);
        }}
        language="uz"
      />
    </div>
  );
};
