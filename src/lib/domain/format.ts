import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

/**
 * `2026-03-31` becomes `31 Mar 2026` - Singapore convention, and unambiguous in
 * a way that a numeric format never is.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "dd MMM yyyy");
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "dd MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return `${formatDistanceToNowStrict(parseISO(iso))} ago`;
  } catch {
    return iso;
  }
}

/** Tax code descriptions arrive as YAML block scalars, full of hard newlines. */
export function collapseWhitespace(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function pluralise(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
