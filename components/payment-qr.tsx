"use client";

import { useMemo, type Ref } from "react";
import Image from "next/image";
import { encode } from "uqr";
import { cn } from "@/lib/utils";

const SHARE_PX = 1024;
const SHARE_MARGIN = 0.04;

const FINDER = 7;
const DOT_R = 0.4;
const FINDER_OUTER_RX = 1.25;
const FINDER_INNER_RX = 0.55;

function isFinderCell(row: number, col: number, dim: number) {
  const inTop = row < FINDER;
  const inBottom = row >= dim - FINDER;
  const inLeft = col < FINDER;
  const inRight = col >= dim - FINDER;
  return (inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft);
}

function Finder({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={6}
        height={6}
        rx={FINDER_OUTER_RX}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={FINDER_INNER_RX} fill="currentColor" />
    </g>
  );
}

export function PaymentQr({
  value,
  className,
  ref,
}: {
  value: string;
  className?: string;
  ref?: Ref<SVGSVGElement>;
}) {
  const qr = useMemo(() => encode(value, { ecc: "H", boostEcc: true, border: 0 }), [value]);
  const dim = qr.size;
  const arena = Math.max(9, Math.floor(dim * 0.22));
  const arenaStart = Math.floor((dim - arena) / 2);

  const dots = useMemo(() => {
    let d = "";
    for (let r = 0; r < dim; r++) {
      const row = qr.data[r];
      if (!row) continue;
      for (let c = 0; c < dim; c++) {
        if (!row[c] || isFinderCell(r, c, dim)) continue;
        if (
          r >= arenaStart &&
          r < arenaStart + arena &&
          c >= arenaStart &&
          c < arenaStart + arena
        ) {
          continue;
        }
        d += `M${c + 0.5 - DOT_R},${r + 0.5}a${DOT_R},${DOT_R} 0 1,0 ${DOT_R * 2},0a${DOT_R},${DOT_R} 0 1,0 ${-DOT_R * 2},0`;
      }
    }
    return d;
  }, [arena, arenaStart, dim, qr.data]);

  return (
    <div
      className={cn(
        "w-full min-w-0 rounded-xl bg-panel-elevated p-2 text-foreground ring-1 ring-border sm:p-3",
        className,
      )}
    >
      <div className="relative">
        <svg
          ref={ref}
          viewBox={`0 0 ${dim} ${dim}`}
          className="block h-auto w-full max-w-full"
          role="img"
          aria-label="Payment link QR code"
        >
          <title>Payment link QR code</title>
          <Finder x={0} y={0} />
          <Finder x={dim - FINDER} y={0} />
          <Finder x={0} y={dim - FINDER} />
          <path d={dots} fill="currentColor" />
        </svg>
        <Image
          src="/logo.svg"
          alt=""
          width={128}
          height={128}
          unoptimized
          className="pointer-events-none absolute inset-bs-1/2 inset-s-1/2 size-[22%] -translate-x-1/2 -translate-y-1/2"
        />
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = document.createElement("img");
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not draw the QR code"));
    image.src = src;
  });
}

/** Rasterize the on-screen QR, with the center logo, into a shareable PNG. */
export async function paymentQrToPngFile(svg: SVGSVGElement): Promise<File> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(SHARE_PX));
  clone.setAttribute("height", String(SHARE_PX));
  clone.style.color = "#000";
  for (const el of clone.querySelectorAll("*")) {
    if (el.getAttribute("fill") === "currentColor") el.setAttribute("fill", "#000");
    if (el.getAttribute("stroke") === "currentColor") el.setAttribute("stroke", "#000");
  }

  const xml = new XMLSerializer().serializeToString(clone);
  const svgUrl = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const [qrImage, logo] = await Promise.all([loadImage(svgUrl), loadImage("/logo.svg")]);
    const canvas = document.createElement("canvas");
    canvas.width = SHARE_PX;
    canvas.height = SHARE_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not draw the QR code");

    const margin = Math.round(SHARE_PX * SHARE_MARGIN);
    const qrBox = SHARE_PX - margin * 2;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, SHARE_PX, SHARE_PX);
    ctx.drawImage(qrImage, margin, margin, qrBox, qrBox);

    const logoBox = qrBox * 0.22;
    const aspect = logo.naturalWidth / logo.naturalHeight || 1;
    const logoWidth = aspect >= 1 ? logoBox : logoBox * aspect;
    const logoHeight = aspect >= 1 ? logoBox / aspect : logoBox;
    const logoX = margin + (qrBox - logoWidth) / 2;
    const logoY = margin + (qrBox - logoHeight) / 2;
    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((encoded) => {
        if (encoded) resolve(encoded);
        else reject(new Error("Could not draw the QR code"));
      }, "image/png");
    });
    return new File([blob], "payment-qr.png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
