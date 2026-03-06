/**
 * Minimal pure-Buffer JPEG EXIF parser.
 * Extracts DateTimeOriginal (tag 0x9003) from JPEG images.
 *
 * No external dependencies — works with any Buffer containing JPEG data.
 *
 * Returns a Date if found and parseable, otherwise null.
 */
export function extractExifDateTimeOriginal(buf: Buffer): Date | null {
  // Scan for APP1 marker (FF E1) followed by "Exif\0\0"
  for (let i = 0; i < buf.length - 16; i++) {
    if (buf[i] !== 0xFF || buf[i + 1] !== 0xE1) continue;
    if (buf.slice(i + 4, i + 10).toString("ascii") !== "Exif\0\0")  continue;

    const tiff  = i + 10;                 // TIFF header start
    const order = buf.slice(tiff, tiff + 2).toString("ascii");
    const le    = order === "II";          // little-endian if "II", big-endian if "MM"

    const r16 = (off: number) => le ? buf.readUInt16LE(off) : buf.readUInt16BE(off);
    const r32 = (off: number) => le ? buf.readUInt32LE(off) : buf.readUInt32BE(off);

    // Validate TIFF magic
    if (r16(tiff + 2) !== 0x002A) continue;

    const ifd0Base   = tiff + r32(tiff + 4);
    const ifd0Count  = r16(ifd0Base);
    let   exifIFDOff: number | null = null;

    // Walk IFD0 entries (12 bytes each)
    for (let t = 0; t < ifd0Count; t++) {
      const entry = ifd0Base + 2 + t * 12;
      if (entry + 12 > buf.length) break;
      const tag = r16(entry);
      if (tag === 0x8769) {
        // ExifSubIFD pointer
        exifIFDOff = tiff + r32(entry + 8);
      }
      if (tag === 0x9003) {
        // DateTimeOriginal found in IFD0 (uncommon but valid)
        const dt = readAsciiDateTime(buf, tiff, entry, r32);
        if (dt) return dt;
      }
    }

    // Walk ExifSubIFD
    if (exifIFDOff !== null) {
      const subCount = r16(exifIFDOff);
      for (let t = 0; t < subCount; t++) {
        const entry = exifIFDOff + 2 + t * 12;
        if (entry + 12 > buf.length) break;
        const tag = r16(entry);
        if (tag === 0x9003) {
          const dt = readAsciiDateTime(buf, tiff, entry, r32);
          if (dt) return dt;
        }
      }
    }

    return null; // APP1 processed, no DateTimeOriginal found
  }
  return null;
}

/**
 * Reads a 20-byte ASCII value from a TIFF entry (type ASCII, count 20).
 * The value is either inline (≤4 bytes) or pointed to by offset.
 */
function readAsciiDateTime(
  buf: Buffer,
  tiffBase: number,
  entryOff: number,
  r32: (n: number) => number
): Date | null {
  const count  = r32(entryOff + 4);     // number of bytes incl. null terminator
  const valOff = count <= 4
    ? entryOff + 8                        // value fits inline
    : tiffBase + r32(entryOff + 8);       // offset into TIFF block

  if (valOff + 19 > buf.length) return null;

  const raw   = buf.slice(valOff, valOff + 19).toString("ascii");
  // Expected format: "YYYY:MM:DD HH:MM:SS"
  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, yr, mo, dy, hh, mm, ss] = match;
  const d = new Date(`${yr}-${mo}-${dy}T${hh}:${mm}:${ss}`);
  return isNaN(d.getTime()) ? null : d;
}
