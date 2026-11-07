/**
 * Minimal PDF writer: one JPEG image per page (DCTDecode), plus an optional title line.
 * Enough for printing layer plans; avoids a heavy PDF dependency.
 */

export interface PdfPage {
  /** JPEG bytes */
  jpeg: Uint8Array;
  width: number;
  height: number;
}

const enc = new TextEncoder();

export function buildPdf(
  pages: PdfPage[],
  pageWidthPt = 595.28,
  pageHeightPt = 841.89,
  marginPt = 28,
): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array | string) => {
    const u = typeof b === "string" ? enc.encode(b) : b;
    chunks.push(u);
    length += u.length;
  };
  const obj = (n: number, body: () => void) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
    body();
    push("\nendobj\n");
  };

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const n = pages.length;
  // object numbers: 1 catalog, 2 pages, then per page: page, content, image
  const pageObj = (i: number) => 3 + i * 3;
  const contentObj = (i: number) => 4 + i * 3;
  const imageObj = (i: number) => 5 + i * 3;

  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () =>
    push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] >>`),
  );
  pages.forEach((p, i) => {
    const portrait = p.height >= p.width;
    const pw = portrait ? pageWidthPt : pageHeightPt;
    const ph = portrait ? pageHeightPt : pageWidthPt;
    const scale = Math.min((pw - 2 * marginPt) / p.width, (ph - 2 * marginPt) / p.height);
    const w = p.width * scale,
      h = p.height * scale;
    const x = (pw - w) / 2,
      y = (ph - h) / 2;
    obj(pageObj(i), () =>
      push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] /Resources << /XObject << /Im${i} ${imageObj(i)} 0 R >> >> /Contents ${contentObj(i)} 0 R >>`,
      ),
    );
    const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${i} Do Q`;
    obj(contentObj(i), () => {
      push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    obj(imageObj(i), () => {
      push(
        `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      );
      push(p.jpeg);
      push("\nendstream");
    });
  });
  const xref = length;
  const count = 3 + n * 3;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let i = 1; i < count; i++) table += `${String(offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export async function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.9): Promise<Uint8Array> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", quality),
  );
  return new Uint8Array(await blob.arrayBuffer());
}
