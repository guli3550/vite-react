import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface OrderItemExport {
  product?: {
    name?: string;
    product_code?: string;
    price?: number;
  };
  size?: string;
  color?: string;
  quantity?: number;
}

export interface OrderExportData {
  id: string;
  createdAt: string;
  status: string;
  payment: string;
  total: number;
  subtotal?: number;
  delivery?: number;
  discount?: number;
  phone?: string;
  items: OrderItemExport[];
  address?: {
    region?: string;
    district?: string;
    street?: string;
    house?: string;
    apartment?: string;
  };
}

export interface ExportPdfOptions {
  orders: OrderExportData[];
  userName?: string;
  userPhone?: string;
  userHandle?: string;
  filterLabel?: string;
}

export function exportOrdersToPDF(options: ExportPdfOptions): boolean {
  const { orders, userName, userPhone, userHandle, filterLabel } = options;
  if (!orders || orders.length === 0) {
    return false;
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header Banner
  doc.setFillColor(189, 82, 106); // #bd526a (Guli Rose Gold / Burgundy)
  doc.rect(0, 0, pageWidth, 28, "F");

  // Brand Title
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("GULI PREMIUM", margin, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("BUYURTMALAR TARIXI VA HISOBOTI", margin, 18);

  // Export Date on right
  const now = new Date();
  const dateStr = now.toLocaleDateString("uz-UZ", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.setFontSize(8);
  doc.text(`Sana: ${dateStr}`, pageWidth - margin, 12, { align: "right" });
  if (filterLabel && filterLabel !== "Barchasi") {
    doc.text(`Filtr: ${filterLabel}`, pageWidth - margin, 18, { align: "right" });
  }

  // Customer Information Card
  doc.setFillColor(253, 248, 249); // #fdf8f9
  doc.setDrawColor(241, 224, 227); // #f1e0e3
  doc.roundedRect(margin, 33, pageWidth - margin * 2, 20, 3, 3, "FD");

  doc.setTextColor(50, 35, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  const clientName = userName || (userHandle ? `@${userHandle}` : "GULI Premium Mijozi");
  doc.text(`Mijoz: ${clientName}`, margin + 5, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(110, 95, 100);
  const phoneText = userPhone ? `Telefon: ${userPhone}` : "Telefon: Bog'lanmagan";
  const handleText = userHandle ? `Telegram: @${userHandle}` : "";
  doc.text(`${phoneText} ${handleText ? ` | ${handleText}` : ""}`, margin + 5, 47);

  // Statistics Summary
  const totalSpent = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const completedCount = orders.filter((o) => o.status === "Yetkazildi").length;
  const inProgressCount = orders.filter((o) => o.status !== "Yetkazildi" && o.status !== "Bekor qilindi").length;

  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const statsY = 57;
  const statCards = [
    { label: "Jami buyurtmalar", val: `${orders.length} ta` },
    { label: "Yetkazilgan", val: `${completedCount} ta` },
    { label: "Jarayonda", val: `${inProgressCount} ta` },
    { label: "Jami harid summasi", val: `${Math.round(totalSpent).toLocaleString("uz-UZ")} so'm` },
  ];

  statCards.forEach((stat, i) => {
    const x = margin + i * (cardWidth + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(238, 222, 225);
    doc.roundedRect(x, statsY, cardWidth, 16, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 110, 115);
    doc.text(stat.label, x + cardWidth / 2, statsY + 5.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(189, 82, 106);
    doc.text(stat.val, x + cardWidth / 2, statsY + 12, { align: "center" });
  });

  // Prepare table data
  const tableRows = orders.map((order) => {
    const orderDate = new Date(order.createdAt);
    const dateFormatted = !Number.isNaN(orderDate.getTime())
      ? orderDate.toLocaleDateString("uz-UZ", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : order.createdAt || "—";

    const itemsSummary = (order.items || [])
      .map((it) => {
        const pName = it.product?.name || "Mahsulot";
        const pCode = it.product?.product_code ? `[Kod: ${it.product.product_code}]` : "";
        const pQty = it.quantity && it.quantity > 1 ? `x${it.quantity}` : "";
        const pOpts = [it.size, it.color].filter(Boolean).join("/");
        const optStr = pOpts ? `(${pOpts})` : "";
        return `${pName} ${pCode} ${optStr} ${pQty}`.trim();
      })
      .join("\n");

    const paymentText = order.payment === "card" ? "Karta" : "Naqd";
    const totalFormatted = `${Math.round(order.total || 0).toLocaleString("uz-UZ")} so'm`;

    return [
      order.id,
      dateFormatted,
      itemsSummary || "Mahsulotlar ro'yxati",
      order.status || "Qabul qilindi",
      paymentText,
      totalFormatted,
    ];
  });

  autoTable(doc, {
    startY: statsY + 21,
    margin: { left: margin, right: margin, bottom: 18 },
    head: [["№ Buyurtma", "Sana", "Mahsulotlar & Kodlar", "Holati", "To'lov", "Summa"]],
    body: tableRows,
    theme: "grid",
    headStyles: {
      fillColor: [189, 82, 106],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
      cellPadding: 3,
    },
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      textColor: [50, 40, 45],
      lineColor: [240, 224, 227],
      lineWidth: 0.2,
      cellPadding: 2.5,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold", textColor: [189, 82, 106] },
      1: { cellWidth: 24, fontSize: 7 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 26, fontStyle: "bold" },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 28, halign: "right", fontStyle: "bold", textColor: [185, 71, 96] },
    },
    alternateRowStyles: {
      fillColor: [254, 250, 251],
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageCount = (doc.internal as any).getNumberOfPages();
      const currentPage = data.pageNumber;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(140, 120, 125);
      doc.text(
        "GULI Premium Lingerie Store · Shaxsiy buyurtmalar hisoboti · guli.uz",
        margin,
        pageHeight - 8
      );
      doc.text(`Sahifa ${currentPage} / ${pageCount}`, pageWidth - margin, pageHeight - 8, {
        align: "right",
      });
    },
  });

  // Save the PDF
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const filename = `GULI_Buyurtmalar_Tarixi_${yyyy}-${mm}-${dd}.pdf`;

  doc.save(filename);
  return true;
}
