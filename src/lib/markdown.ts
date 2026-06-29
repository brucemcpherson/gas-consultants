/**
 * Normalizes common variations of extracted markdown-like links so standard parsers can render them properly.
 * E.g., "[Google Cloud] (https://cloud.google.com)" -> "[Google Cloud](https://cloud.google.com)"
 * E.g., "[My Document] (https://drive.google.com/file/d/abc/view]" -> "[My Document](https://drive.google.com/file/d/abc/view)"
 */
export function sanitizeMarkdownLinks(text: string | null | undefined): string {
  if (!text) return "";
  let sanitized = text;

  // 1. Convert "[Label] (url)" to standard "[Label](url)"
  sanitized = sanitized.replace(/\[([^\]]+)\]\s+\((https?:\/\/[^\s)]+)\)/g, "[$1]($2)");

  // 2. Fix misplaced trailing bracket, e.g. "[Label](url]" or "[Label] (url]" to standard "[Label](url)"
  sanitized = sanitized.replace(/\[([^\]]+)\]\s*\((https?:\/\/[^\s\])]+)\]/g, "[$1]($2)");

  // 3. Fallback for any other custom link formats or non-standard protocols that might use closing square bracket
  sanitized = sanitized.replace(/\[([^\]]+)\]\s*\(([^\])]+)\]/g, "[$1]($2)");

  return sanitized;
}
