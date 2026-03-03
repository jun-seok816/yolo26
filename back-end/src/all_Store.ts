export const toSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function fmt(dt?: string | Date | null) {
  if (!dt) return "-";
  const d = typeof dt === "string" ? new Date(dt) : dt;
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

// ---------------------- 공용 유틸 ----------------------
export function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function computeNextAt(currentPeriodEnd: Date | null): Date {
  if (currentPeriodEnd) return new Date(currentPeriodEnd);
  const d = new Date();
  d.setMinutes(d.getMinutes() + 1);
  return d;
}

export function toMySQLDateTimeUTC(input?: string | Date) {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) throw new Error('INVALID_DATE');
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');  
  const Y = d.getUTCFullYear();
  const M = pad(d.getUTCMonth() + 1);
  const D = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const m = pad(d.getUTCMinutes());
  const s = pad(d.getUTCSeconds());  
  return `${Y}-${M}-${D} ${h}:${m}:${s}`; 
}