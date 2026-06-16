/** 말일 기준 월급날 계산 (토→금, 일→금 앞당김) */
export function getPayday(year: number, month: number): Date {
  const last = new Date(year, month + 1, 0);
  const d = new Date(last);
  const dow = last.getDay();
  if (dow === 6) d.setDate(d.getDate() - 1);
  else if (dow === 0) d.setDate(d.getDate() - 2);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 오늘이 월급날인지 여부 */
export function isPayday(now = new Date()): boolean {
  const payday = getPayday(now.getFullYear(), now.getMonth());
  return isSameDay(now, payday);
}
