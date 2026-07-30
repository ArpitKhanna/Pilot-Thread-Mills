import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { buildWhatsAppShareUrl } from "@/lib/salesmen/mock-data";
import type { Invoice } from "@/lib/salesmen/types";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

function openWhatsApp(phone: string, invoice: Invoice, partyName: string) {
  const url = buildWhatsAppShareUrl(phone, invoice, partyName);
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Make #invoice-print-root (and hidden ancestors) capturable off-screen,
 * then restore previous inline styles.
 */
function revealPrintRoot(root: HTMLElement): () => void {
  const restores: Array<() => void> = [];

  let el: HTMLElement | null = root;
  while (el) {
    const computed = window.getComputedStyle(el);
    if (computed.display === "none" || computed.visibility === "hidden") {
      const target = el;
      const prev = {
        display: target.style.display,
        visibility: target.style.visibility,
        position: target.style.position,
        left: target.style.left,
        top: target.style.top,
        width: target.style.width,
        zIndex: target.style.zIndex,
        pointerEvents: target.style.pointerEvents,
        opacity: target.style.opacity,
      };
      target.style.display = "block";
      target.style.visibility = "visible";
      target.style.opacity = "1";
      target.style.position = "fixed";
      target.style.left = "-12000px";
      target.style.top = "0";
      target.style.width = "210mm";
      target.style.zIndex = "-1";
      target.style.pointerEvents = "none";
      restores.push(() => {
        target.style.display = prev.display;
        target.style.visibility = prev.visibility;
        target.style.position = prev.position;
        target.style.left = prev.left;
        target.style.top = prev.top;
        target.style.width = prev.width;
        target.style.zIndex = prev.zIndex;
        target.style.pointerEvents = prev.pointerEvents;
        target.style.opacity = prev.opacity;
      });
    }
    el = el.parentElement;
  }

  const prevRootWidth = root.style.width;
  root.style.width = "210mm";
  restores.push(() => {
    root.style.width = prevRootWidth;
  });

  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

async function downloadInvoicePdfFromPrintRoot(
  root: HTMLElement,
  filename: string,
): Promise<void> {
  const restore = revealPrintRoot(root);
  try {
    // Allow layout to settle after un-hiding.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const pages = Array.from(
      root.querySelectorAll<HTMLElement>(".invoice-a4-page"),
    );
    if (pages.length === 0) {
      throw new Error("No invoice pages found to export");
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page) continue;
      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
    }

    pdf.save(filename);
  } finally {
    restore();
  }
}

/**
 * Download the invoice preview as a PDF, then open WhatsApp with a caption
 * so staff can attach the downloaded file.
 */
export async function shareInvoicePdfOnWhatsApp(opts: {
  phone: string;
  invoice: Invoice;
  partyName: string;
  printRootId?: string;
}): Promise<void> {
  const { phone, invoice, partyName } = opts;
  const rootId = opts.printRootId ?? "invoice-print-root";
  const filename = `${invoice.number}.pdf`;

  try {
    const root = document.getElementById(rootId);
    if (!root) {
      throw new Error("Invoice preview is not ready");
    }
    await downloadInvoicePdfFromPrintRoot(root, filename);
    // Give the browser a beat to start the download before switching tabs.
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    openWhatsApp(phone, invoice, partyName);
  } catch {
    openWhatsApp(phone, invoice, partyName);
    throw new Error(
      "Could not generate the PDF. WhatsApp opened with the invoice details — attach the file manually if you have it.",
    );
  }
}
