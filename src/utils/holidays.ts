import { useEffect, useState } from "react";

/** 대한민국 공휴일 { "YYYY-MM-DD": "공휴일 이름" } (대체공휴일은 대체된 날짜로 들어옴) */
export type HolidayMap = Record<string, string>;

const CACHE_PREFIX = "kr-holidays-";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

function readCache(year: number): HolidayMap | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + year);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (Date.now() - savedAt > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(year: number, data: HolidayMap) {
  try {
    localStorage.setItem(CACHE_PREFIX + year, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // 저장 실패는 무시 (다음에 다시 받아옴)
  }
}

/** Nager.Date 공개 API에서 해당 연도 공휴일을 가져온다 (키 불필요) */
async function fetchHolidays(year: number): Promise<HolidayMap> {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`);
  if (!res.ok) throw new Error(`holiday fetch failed: ${res.status}`);
  const list: { date: string; localName: string }[] = await res.json();
  const map: HolidayMap = {};
  for (const h of list) map[h.date] = map[h.date] ? `${map[h.date]}·${h.localName}` : h.localName;
  return map;
}

export function useKoreanHolidays(year: number): HolidayMap {
  const [holidays, setHolidays] = useState<HolidayMap>(() => readCache(year) || {});

  useEffect(() => {
    const cached = readCache(year);
    if (cached) {
      setHolidays(cached);
      return;
    }
    setHolidays({});
    let cancelled = false;
    fetchHolidays(year)
      .then((map) => {
        writeCache(year, map);
        if (!cancelled) setHolidays(map);
      })
      .catch(() => {
        // 네트워크 실패 시 공휴일 표시 없이 진행 (일요일/수동 휴일은 그대로 표시)
      });
    return () => { cancelled = true; };
  }, [year]);

  return holidays;
}
