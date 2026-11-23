import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, RefreshCw, Copy, Check, QrCode } from "lucide-react";
import { copyToClipboard } from "../../utils/clipboard";

export type PromoRecord = {
  id?: number;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_discount_amount?: number | null;
  min_order_amount: number;
  usage_limit: number | null;
  used_count: number;
  starts_at?: string | null;
  expires_at?: string | null;
  active: boolean;
  promo_kind?: "promo" | "qr";
  qr_label?: string;
  qr_color?: string;
};

export const QR_COLOR_PRESETS = [
  { id: "rose", label: "Guli Rose", color: "#9f3654" },
  { id: "plum", label: "Qora Guli", color: "#1c1317" },
  { id: "berry", label: "To‘q olcha", color: "#881337" },
  { id: "emerald", label: "Zumrad", color: "#0f766e" },
];

export function generateQrPromoCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `GULIQR-${suffix}`;
}

export function buildQrVoucherPayload(code: string): string {
  const clean = String(code || "").trim().toUpperCase();
  if (!clean) return "";
  return `https://gulii.uz/?promo=${encodeURIComponent(clean)}`;
}

export function formatMoneyShort(n: number): string {
  return `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so‘m`;
}

export async function downloadQrVoucherCardPng(promo: PromoRecord): Promise<void> {
  const code = String(promo.code || "").trim().toUpperCase();
  if (!code) return;

  const fgColor = promo.qr_color && /^#[0-9a-fA-F]{6}$/.test(promo.qr_color) ? promo.qr_color : "#9f3654";
  const payloadUrl = buildQrVoucherPayload(code);
  const qrDataUrl = await QRCode.toDataURL(payloadUrl, {
    width: 440,
    margin: 2,
    errorCorrectionLevel: "H",
    color: {
      dark: fgColor,
      light: "#ffffff",
    },
  });

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 840;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background card
  ctx.fillStyle = "#fff9fa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer frame
  ctx.strokeStyle = "#f0dfe3";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 600, 800);

  // Header gradient strip
  const grad = ctx.createLinearGradient(0, 0, 640, 180);
  grad.addColorStop(0, "#bd526a");
  grad.addColorStop(1, "#9f3654");
  ctx.fillStyle = grad;
  ctx.fillRect(20, 20, 600, 150);

  // Brand title
  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 34px Georgia, "Times New Roman", serif';
  ctx.textAlign = "center";
  ctx.fillText("GULI MARKET", 320, 82);

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "600 18px sans-serif";
  ctx.fillText((promo.qr_label || "QR CHEGIRMA VAUCHERI").toUpperCase(), 320, 128);

  // Discount highlight
  const discountLabel =
    promo.discount_type === "percent"
      ? `${promo.discount_value}% CHEGIRMA`
      : `${formatMoneyShort(promo.discount_value)} CHEGIRMA`;
  ctx.fillStyle = fgColor;
  ctx.font = "bold 40px sans-serif";
  ctx.fillText(discountLabel, 320, 232);

  // Sub-details
  const rules: string[] = [];
  if (Number(promo.min_order_amount) > 0) {
    rules.push(`Min. buyurtma: ${formatMoneyShort(promo.min_order_amount)}`);
  }
  if (promo.discount_type === "percent" && promo.max_discount_amount && Number(promo.max_discount_amount) > 0) {
    rules.push(`Maks. chegirma: ${formatMoneyShort(promo.max_discount_amount)}`);
  }
  ctx.fillStyle = "#6d5e64";
  ctx.font = "500 18px sans-serif";
  ctx.fillText(rules.join(" · ") || "gulii.uz — Buyurtmada skanerlang", 320, 268);

  // White QR container
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(100, 300, 440, 440);
  ctx.strokeStyle = "#f0dfe3";
  ctx.lineWidth = 2;
  ctx.strokeRect(100, 300, 440, 440);

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = qrDataUrl;
  });
  ctx.drawImage(img, 120, 320, 400, 400);

  // Bottom code pill
  ctx.fillStyle = "#21191c";
  ctx.font = "bold 24px monospace";
  ctx.fillText(code, 320, 782);

  const link = document.createElement("a");
  link.download = `${code}-GuliMarket-QR.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export const QrCodeThumbnail: React.FC<{ code: string; color?: string }> = ({
  code,
  color = "#9f3654",
}) => {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;
    const clean = String(code || "").trim().toUpperCase();
    if (!clean) {
      setSrc("");
      return;
    }
    QRCode.toDataURL(buildQrVoucherPayload(clean), {
      width: 96,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#9f3654",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc("");
      });
    return () => {
      active = false;
    };
  }, [code, color]);

  if (!src) {
    return (
      <div className="adminQrThumbPlaceholder">
        <QrCode size={18} />
      </div>
    );
  }

  return <img src={src} alt={`QR ${code}`} className="adminQrThumbImg" />;
};

export const AdminQrPreviewPanel: React.FC<{
  promo: PromoRecord;
  onGenerateCode?: () => void;
  onChangeLabel?: (val: string) => void;
  onChangeColor?: (hex: string) => void;
  onNotify?: (msg: string) => void;
}> = ({ promo, onGenerateCode, onChangeLabel, onChangeColor, onNotify }) => {
  const [qrSrc, setQrSrc] = useState("");
  const [copied, setCopied] = useState(false);

  const cleanCode = String(promo.code || "").trim().toUpperCase();
  const activeColor =
    promo.qr_color && /^#[0-9a-fA-F]{6}$/.test(promo.qr_color) ? promo.qr_color : "#9f3654";

  useEffect(() => {
    let mounted = true;
    if (!cleanCode) {
      setQrSrc("");
      return;
    }
    QRCode.toDataURL(buildQrVoucherPayload(cleanCode), {
      width: 300,
      margin: 2,
      errorCorrectionLevel: "H",
      color: {
        dark: activeColor,
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (mounted) setQrSrc(url);
      })
      .catch(() => {
        if (mounted) setQrSrc("");
      });
    return () => {
      mounted = false;
    };
  }, [cleanCode, activeColor]);

  const handleCopy = async () => {
    if (!cleanCode) return;
    await copyToClipboard(cleanCode);
    setCopied(true);
    onNotify?.("QR kod nusxalandi ✓");
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = async () => {
    if (!cleanCode) return;
    await downloadQrVoucherCardPng(promo);
    onNotify?.("QR vaucher PNG yuklab olindi ✓");
  };

  return (
    <div className="adminQrBuilderCard fullRow">
      <div className="adminQrPreviewSide">
        <div className="adminQrPreviewFrame">
          {qrSrc ? (
            <img src={qrSrc} alt={`QR ${cleanCode}`} />
          ) : (
            <div className="adminQrEmptyState">
              <QrCode size={36} />
              <span>Kod kiriting</span>
            </div>
          )}
        </div>
        <div className="adminQrPreviewMeta">
          <span className="adminQrBrandBadge">GULI MARKET</span>
          <b>{cleanCode || "GULIQR-..."}</b>
          <small>
            {promo.discount_type === "percent"
              ? `${promo.discount_value || 0}% chegirma`
              : `${formatMoneyShort(promo.discount_value || 0)} chegirma`}
          </small>
        </div>
      </div>

      <div className="adminQrConfigSide">
        {onChangeLabel && (
          <label>
            QR vaucher sarlavhasi (ixtiyoriy)
            <input
              value={promo.qr_label || ""}
              onChange={(e) => onChangeLabel(e.target.value)}
              placeholder="Masalan: VIP Mijoz Vaucheri"
              maxLength={60}
            />
          </label>
        )}

        {onChangeColor && (
          <div className="adminQrColorBlock">
            <span className="adminQrFieldLabel">QR rang uslubi</span>
            <div className="adminQrSwatches">
              {QR_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`adminQrSwatchBtn ${activeColor === preset.color ? "active" : ""}`}
                  onClick={() => onChangeColor(preset.color)}
                  title={preset.label}
                >
                  <span style={{ backgroundColor: preset.color }} />
                  <small>{preset.label}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="adminQrActionRow">
          {onGenerateCode && (
            <button type="button" className="adminQrSecBtn" onClick={onGenerateCode}>
              <RefreshCw size={14} />
              <span>Yangi kod</span>
            </button>
          )}
          <button
            type="button"
            className="adminQrSecBtn"
            onClick={handleCopy}
            disabled={!cleanCode}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? "Nusxalandi" : "Nusxalash"}</span>
          </button>
          <button
            type="button"
            className="adminQrDownloadBtn"
            onClick={handleDownload}
            disabled={!cleanCode}
          >
            <Download size={14} />
            <span>PNG yuklash</span>
          </button>
        </div>
      </div>
    </div>
  );
};
