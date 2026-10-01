/** 로컬(한국) 시간 기준 YYYY-MM-DD. toISOString()은 UTC라 오전 9시 전엔 전날이 된다. */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 로컬 시간 기준 YYYY-MM */
export function localMonthStr(d: Date = new Date()): string {
  return localDateStr(d).slice(0, 7);
}
