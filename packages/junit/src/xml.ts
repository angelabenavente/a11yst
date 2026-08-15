function isInvalidXmlChar(codePoint: number): boolean {
  if (codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd) {
    return false;
  }
  if (codePoint < 0x20) {
    return true;
  }
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
    return true;
  }
  return codePoint === 0xfffe || codePoint === 0xffff;
}

function isValidXmlCodePoint(codePoint: number): boolean {
  return !isInvalidXmlChar(codePoint);
}

export function sanitizeXmlString(value: string): string {
  let sanitized = "";
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    sanitized += isValidXmlCodePoint(codePoint) ? char : " ";
  }
  return sanitized.replace(/\s+/g, " ").trim();
}

export function escapeXmlAttribute(value: string): string {
  return sanitizeXmlString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/[\r\n\t]+/g, " ");
}

export function escapeXmlText(value: string): string {
  return sanitizeXmlString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}
