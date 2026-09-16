import { useState, useEffect, useRef, FormEvent } from "react";
import { Plus, Trash2, Wallet, CreditCard, X, ChevronDown, ChevronLeft, Edit2, Save } from "lucide-react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../utils/firebaseAuth";
import { saveTravelData, loadTravelData, subscribeTravelData } from "../utils/travelFirestore";
// @ts-ignore
import styles from "../css/TravelPage.module.css";
// @ts-ignore
import modalStyles from "../css/Modals.module.css";

interface FixedItem {
  id: string;
  name: string;
  amount: number;
}

interface SpendItem {
  id: string;
  name: string;
  amount: number;
  currency: "KRW" | "LOCAL";
  type: "cash" | "card";
  date: string;
}

interface Trip {
  id: string;
  name: string;
  currencyCode: string;   // 예: "JPY", "USD" — 자유 입력
  currencySymbol: string; // 예: "¥", "$"
  exchangeRate: number;   // 현지통화 1 = ?원
  cashBudget: number;
  cardBudget: number;
  startDate: string;
  endDate: string;
  fixedItems: FixedItem[];
  spendItems: SpendItem[];
}

interface TripDraft {
  name: string;
  currencyCode: string;
  currencySymbol: string;
  exchangeRate: string;
  cashBudget: string;
  cardBudget: string;
  startDate: string;
  endDate: string;
}

const makeTrip = (overrides: Partial<Trip> = {}): Trip => ({
  id: Date.now().toString(),
  name: "",
  currencyCode: "JPY",
  currencySymbol: "¥",
  exchangeRate: 9.5,
  cashBudget: 0,
  cardBudget: 0,
  startDate: "",
  endDate: "",
  fixedItems: [],
  spendItems: [],
  ...overrides,
});

// 여행지 선택 시 통화 코드/기호/환율을 자동으로 채워주는 프리셋 (환율은 참고용 기준값 — 저장 후에도 직접 수정 가능)
const CURRENCY_PRESETS: { country: string; code: string; symbol: string; rate: number }[] = [
  { country: "일본", code: "JPY", symbol: "¥", rate: 9.5 },
  { country: "미국", code: "USD", symbol: "$", rate: 1400 },
  { country: "태국", code: "THB", symbol: "฿", rate: 38 },
  { country: "베트남", code: "VND", symbol: "₫", rate: 0.055 },
  { country: "필리핀", code: "PHP", symbol: "₱", rate: 24 },
  { country: "대만", code: "TWD", symbol: "NT$", rate: 43 },
  { country: "홍콩", code: "HKD", symbol: "HK$", rate: 178 },
  { country: "싱가포르", code: "SGD", symbol: "S$", rate: 1030 },
  { country: "중국", code: "CNY", symbol: "¥", rate: 190 },
  { country: "유럽(유로존)", code: "EUR", symbol: "€", rate: 1500 },
  { country: "영국", code: "GBP", symbol: "£", rate: 1750 },
  { country: "호주", code: "AUD", symbol: "A$", rate: 900 },
  { country: "캐나다", code: "CAD", symbol: "C$", rate: 1000 },
  { country: "인도네시아", code: "IDR", symbol: "Rp", rate: 0.087 },
  { country: "말레이시아", code: "MYR", symbol: "RM", rate: 310 },
];

// Firestore에 아직 아무 데이터도 없을 때 보여줄 기본 여행(원래 하드코딩되어 있던 도쿄 여행 데이터)
const DEFAULT_TOKYO_TRIP = makeTrip({
  id: "trip-tokyo-default",
  name: "도쿄 여행",
  currencyCode: "JPY",
  currencySymbol: "¥",
  exchangeRate: 9.5,
  cashBudget: 9000,
  cardBudget: 15000,
  fixedItems: [
    { id: "1", name: "비행기", amount: 317120 },
    { id: "2", name: "숙소", amount: 310129 },
    { id: "3", name: "이심", amount: 10780 },
    { id: "4", name: "여행자보험", amount: 10000 },
    { id: "5", name: "디즈니씨", amount: 79600 },
  ],
});

const blankDraft = (): TripDraft => ({
  name: "", currencyCode: "JPY", currencySymbol: "¥",
  exchangeRate: "9.5", cashBudget: "", cardBudget: "", startDate: "", endDate: "",
});

const draftFromTrip = (t: Trip): TripDraft => ({
  name: t.name, currencyCode: t.currencyCode, currencySymbol: t.currencySymbol,
  exchangeRate: String(t.exchangeRate), cashBudget: String(t.cashBudget), cardBudget: String(t.cardBudget),
  startDate: t.startDate, endDate: t.endDate,
});

function getDates(start: string, end: string): string[] {
  if (!start || !end) return [];
  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export default function TravelPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [view, setView] = useState<"list" | "trip">("list");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [tripModalMode, setTripModalMode] = useState<"create" | "edit">("create");
  const [tripDraft, setTripDraft] = useState<TripDraft>(blankDraft());

  const [activeDate, setActiveDate] = useState<string>("all");
  const [spendOpen, setSpendOpen] = useState(true);
  const [dragOverIdx, setDragOverIdx] = useState<string | null>(null);
  const [editingSpendId, setEditingSpendId] = useState<string | null>(null);
  const [editingSpendData, setEditingSpendData] = useState<{ name: string; amount: string; currency: "KRW" | "LOCAL"; type: "cash" | "card" } | null>(null);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [editingFixedData, setEditingFixedData] = useState<{ name: string; amount: string } | null>(null);
  const [fixedOpen, setFixedOpen] = useState(false);
  const [isAddingFixed, setIsAddingFixed] = useState(false);
  const [newFixed, setNewFixed] = useState({ name: "", amount: "" });

  const isRemoteUpdate = useRef(false);
  const firestoreUnsub = useRef<(() => void) | null>(null);

  const [newSpend, setNewSpend] = useState({
    name: "", amount: "", currency: "LOCAL" as "KRW" | "LOCAL",
    type: "cash" as "cash" | "card", date: new Date().toISOString().slice(0, 10),
  });

  const activeTrip = trips.find((t) => t.id === activeTripId) || null;

  const updateTrip = (id: string, updater: (t: Trip) => Trip) => {
    setTrips((prev) => prev.map((t) => (t.id === id ? updater(t) : t)));
  };

  // 활성 여행이 목록에서 사라졌으면(삭제 등) 첫 번째 여행으로 보정
  useEffect(() => {
    if (trips.length === 0) {
      if (activeTripId !== null) setActiveTripId(null);
      return;
    }
    if (!activeTripId || !trips.some((t) => t.id === activeTripId)) {
      setActiveTripId(trips[0].id);
    }
  }, [trips, activeTripId]);

  // Firestore 저장
  useEffect(() => {
    if (!user) return; // 로그인 안 된 상태에서는 저장 시도조차 하지 않는다
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    if (isLoading) return;
    const timer = setTimeout(() => {
      saveTravelData({ trips, activeTripId }).catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [trips, activeTripId, isLoading, user]);

  // 레거시(단일 여행) 데이터를 새 다중 여행 구조로 변환
  const applyRemote = (data: any) => {
    if (Array.isArray(data.trips)) {
      setTrips(data.trips);
      const validId = data.activeTripId && data.trips.some((t: Trip) => t.id === data.activeTripId)
          ? data.activeTripId
          : (data.trips[0]?.id ?? null);
      setActiveTripId(validId);
    } else if (data.settings || data.fixedItems || data.spendItems) {
      const legacyTrip = makeTrip({
        id: "trip-legacy",
        name: "도쿄 여행",
        currencyCode: "JPY",
        currencySymbol: "¥",
        exchangeRate: data.settings?.exchangeRate ?? 9.5,
        cashBudget: data.settings?.cashBudget ?? 0,
        cardBudget: data.settings?.cardBudget ?? 0,
        startDate: data.settings?.startDate ?? "",
        endDate: data.settings?.endDate ?? "",
        fixedItems: data.fixedItems ?? [],
        spendItems: (data.spendItems ?? []).map((i: any) => ({
          ...i,
          currency: i.currency === "KRW" ? "KRW" : "LOCAL",
        })),
      });
      setTrips([legacyTrip]);
      setActiveTripId(legacyTrip.id);
    }
  };

  // 로그인 세션 확인 — Firestore 보안 규칙이 인증된 사용자만 허용하므로,
  // 로그인 상태가 확정되기 전에 쿼리를 보내면 request.auth가 아직 null이라 권한 오류가 난다.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return; // 로그인 상태 확인 전에는 아무것도 하지 않는다
    if (!user) { setIsLoading(false); return; } // 로그인 안 됨 — 별도 안내 화면 표시

    const init = async () => {
      try {
        const remote = await loadTravelData();
        if (remote) {
          isRemoteUpdate.current = true;
          applyRemote(remote);
        } else {
          // Firestore에 아직 아무 여행도 저장된 적 없으면 도쿄 여행 기본값으로 시작
          setTrips([DEFAULT_TOKYO_TRIP]);
          setActiveTripId(DEFAULT_TOKYO_TRIP.id);
        }
      } catch (e) {
        // 불러오기 자체가 실패한 경우: 실제 저장된 데이터가 있는지 알 수 없으므로
        // 절대 기본값으로 덮어쓰지 않는다(자동저장이 실제 데이터를 지울 수 있음).
        console.error(e);
        setLoadError(true);
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      firestoreUnsub.current = subscribeTravelData((data) => {
        isRemoteUpdate.current = true;
        applyRemote(data);
      });
    };
    init();
    return () => { if (firestoreUnsub.current) firestoreUnsub.current(); };
  }, [isAuthReady, user]);

  const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
  const fmtLocal = (n: number) => Math.round(n).toLocaleString("ko-KR");
  const toKRW = (item: SpendItem) => !activeTrip ? 0 : (item.currency === "KRW" ? item.amount : item.amount * activeTrip.exchangeRate);

  const dates = activeTrip ? getDates(activeTrip.startDate, activeTrip.endDate) : [];
  const allSpend = activeTrip?.spendItems ?? [];
  const filteredSpend = activeDate === "all" ? allSpend : allSpend.filter((i) => i.date === activeDate);

  const totalFixed = (activeTrip?.fixedItems ?? []).reduce((sum, i) => sum + i.amount, 0);
  const totalSpent = allSpend.reduce((sum, i) => sum + toKRW(i), 0);
  const filteredSpent = filteredSpend.reduce((sum, i) => sum + toKRW(i), 0);
  const grandTotal = totalFixed + totalSpent;

  const cashSpentLocal = allSpend.filter((i) => i.type === "cash" && i.currency === "LOCAL").reduce((sum, i) => sum + i.amount, 0);
  const cardSpentLocal = allSpend.filter((i) => i.type === "card" && i.currency === "LOCAL").reduce((sum, i) => sum + i.amount, 0);
  const cashRemaining = (activeTrip?.cashBudget ?? 0) - cashSpentLocal;
  const cardRemaining = (activeTrip?.cardBudget ?? 0) - cardSpentLocal;

  const addSpend = () => {
    if (!activeTrip) return;
    const amt = parseFloat(newSpend.amount.replace(/,/g, ""));
    if (!newSpend.name || isNaN(amt) || amt <= 0) return;
    updateTrip(activeTrip.id, (t) => ({
      ...t, spendItems: [...t.spendItems, { id: Date.now().toString(), ...newSpend, amount: amt }],
    }));
    setNewSpend((p) => ({ ...p, name: "", amount: "" }));
    setIsModalOpen(false);
  };

  const getDayLabel = (date: string) => {
    if (!activeTrip?.startDate) return date;
    const start = new Date(activeTrip.startDate);
    const cur = new Date(date);
    const diff = Math.round((cur.getTime() - start.getTime()) / 86400000);
    const [, m, d] = date.split("-");
    return `Day${diff + 1} (${parseInt(m)}/${parseInt(d)})`;
  };

  const openCreateTripModal = () => {
    setTripModalMode("create");
    setTripDraft(blankDraft());
    setIsTripModalOpen(true);
  };

  const openEditTripModal = () => {
    if (!activeTrip) return;
    setTripModalMode("edit");
    setTripDraft(draftFromTrip(activeTrip));
    setIsTripModalOpen(true);
  };

  const saveTripDraft = (e: FormEvent) => {
    e.preventDefault();
    const name = tripDraft.name.trim();
    if (!name) return;
    const rate = parseFloat(tripDraft.exchangeRate) || 0;
    const cash = parseInt(tripDraft.cashBudget, 10) || 0;
    const card = parseInt(tripDraft.cardBudget, 10) || 0;
    const currencyCode = tripDraft.currencyCode.trim() || "JPY";
    const currencySymbol = tripDraft.currencySymbol.trim() || "¥";

    if (tripModalMode === "create") {
      const trip = makeTrip({
        name, currencyCode, currencySymbol, exchangeRate: rate,
        cashBudget: cash, cardBudget: card,
        startDate: tripDraft.startDate, endDate: tripDraft.endDate,
      });
      setTrips((prev) => [...prev, trip]);
      setActiveTripId(trip.id);
      setActiveDate("all");
      setView("trip");
    } else if (activeTrip) {
      updateTrip(activeTrip.id, (t) => ({
        ...t, name, currencyCode, currencySymbol, exchangeRate: rate,
        cashBudget: cash, cardBudget: card,
        startDate: tripDraft.startDate, endDate: tripDraft.endDate,
      }));
    }
    setIsTripModalOpen(false);
  };

  const deleteTrip = (id: string) => {
    if (!window.confirm("이 여행 기록을 통째로 삭제하시겠습니까?")) return;
    setTrips((prev) => prev.filter((t) => t.id !== id));
  };

  const addFixed = () => {
    if (!activeTrip) return;
    const amt = parseInt(newFixed.amount, 10);
    if (!newFixed.name.trim() || isNaN(amt) || amt <= 0) return;
    updateTrip(activeTrip.id, (t) => ({
      ...t, fixedItems: [...t.fixedItems, { id: Date.now().toString(), name: newFixed.name.trim(), amount: amt }],
    }));
    setNewFixed({ name: "", amount: "" });
    setIsAddingFixed(false);
  };

  if (isLoading) {
    return (
        <div className={styles.loadingWrap}>
          <div>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>불러오는 중...</p>
          </div>
        </div>
    );
  }

  if (loadError) {
    return (
        <div className={styles.loadingWrap}>
          <div style={{ textAlign: "center", padding: "0 1.5rem" }}>
            <p className={styles.loadingText}>저장된 여행 데이터를 불러오지 못했어요.<br />실제 데이터를 덮어쓰지 않도록 안전하게 멈췄습니다.</p>
            <button onClick={() => window.location.reload()} className={styles.emptyPageBtn} style={{ marginTop: "1rem" }}>
              다시 시도
            </button>
          </div>
        </div>
    );
  }

  if (!user) {
    return (
        <div className={styles.loadingWrap}>
          <div style={{ textAlign: "center", padding: "0 1.5rem" }}>
            <p className={styles.loadingText}>로그인이 필요해요.<br />홈 화면에서 먼저 로그인해주세요.</p>
            <a href="/" className={styles.emptyPageBtn} style={{ marginTop: "1rem", display: "inline-flex", textDecoration: "none" }}>
              홈으로 이동
            </a>
          </div>
        </div>
    );
  }

  const showList = view === "list" || !activeTrip;

  return (
      <div className={styles.page}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.headerTop}>
              {showList ? (
                  <div className={styles.tripSwitchBtn} style={{ cursor: "default" }}>
                    <span className={styles.tripIcon}>✈️</span>
                    <span className={styles.tripName}>여행 목록</span>
                  </div>
              ) : (
                  <button onClick={() => setView("list")} className={styles.tripSwitchBtn} title="여행 목록으로">
                    <ChevronLeft className={styles.tripChevron} />
                    <span className={styles.tripIcon}>✈️</span>
                    <span className={styles.tripName}>{activeTrip.name || "이름 없는 여행"}</span>
                  </button>
              )}
              <div className={styles.headerActions}>
                {showList ? (
                    <button onClick={openCreateTripModal} className={styles.pillBtn} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <Plus size={12} />추가
                    </button>
                ) : (
                    <>
                      <button onClick={() => setActiveDate("all")} className={styles.pillBtn} data-active={activeDate === "all"}>
                        전체
                      </button>
                      <button onClick={openEditTripModal} className={styles.pillBtn}>
                        ⚙️ 설정
                      </button>
                    </>
                )}
              </div>
            </div>

            {/* 날짜 탭 */}
            {!showList && dates.length > 0 && (
                <div className={styles.dateTabs}>
                  {dates.map((d) => (
                      <button key={d} onClick={() => setActiveDate(d)} className={styles.dateTab} data-active={activeDate === d}>
                        {getDayLabel(d)}
                      </button>
                  ))}
                </div>
            )}
          </div>
        </header>

        <main className={styles.main}>
          {trips.length === 0 && showList ? (
              <div className={styles.emptyPage}>
                <p className={styles.emptyPageText}>등록된 여행이 없어요</p>
                <button onClick={openCreateTripModal} className={styles.emptyPageBtn}>
                  <Plus size={16} /> 첫 여행 추가하기
                </button>
              </div>
          ) : showList ? (
              <div className={styles.card}>
                <div className={styles.cardBody} style={{ paddingTop: "1.25rem" }}>
                  {trips.map((t) => (
                      <div key={t.id}
                           onClick={() => { setActiveTripId(t.id); setActiveDate("all"); setView("trip"); }}
                           className={styles.tripListItem}>
                        <div className={styles.tripListInfo}>
                          <p className={styles.tripListName}>{t.name || "이름 없는 여행"}</p>
                          {t.startDate && t.endDate && <p className={styles.tripListDates}>{t.startDate} ~ {t.endDate}</p>}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteTrip(t.id); }} className={styles.tripListDelete}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                  ))}
                </div>
              </div>
          ) : activeTrip ? (
              <>
                {/* 총 예상 경비 */}
                <div className={styles.totalCard}>
                  <p className={styles.totalLabel}>
                    {activeDate === "all" ? "총 경비" : `${getDayLabel(activeDate)} 지출`}
                  </p>
                  <p className={styles.totalAmount}>
                    {activeDate === "all" ? fmt(grandTotal) : fmt(filteredSpent)}원
                  </p>
                  {activeDate === "all" && (
                      <div className={styles.totalBreakdown}>
                        <div>
                          <p className={styles.totalBreakdownLabel}>사전 지출</p>
                          <p className={styles.totalBreakdownValue}>{fmt(totalFixed)}원</p>
                        </div>
                        <div>
                          <p className={styles.totalBreakdownLabel}>현지 지출</p>
                          <p className={`${styles.totalBreakdownValue} ${styles.totalBreakdownValueRed}`}>{fmt(totalSpent)}원</p>
                        </div>
                      </div>
                  )}
                </div>

                {/* 현지통화 잔여 */}
                <div className={styles.balanceGrid}>
                  <div className={styles.balanceCard}>
                    <div className={styles.balanceHead}>
                      <Wallet className={styles.balanceHeadIcon} />
                      <span className={styles.balanceHeadLabel}>현금 잔여</span>
                    </div>
                    <p className={styles.balanceAmount} data-negative={cashRemaining < 0}>
                      {activeTrip.currencySymbol}{fmtLocal(Math.abs(cashRemaining))}{cashRemaining < 0 ? " 초과" : ""}
                    </p>
                    <p className={styles.balanceSub}>{activeTrip.currencySymbol}{fmtLocal(cashSpentLocal)} / {activeTrip.currencySymbol}{fmtLocal(activeTrip.cashBudget)}</p>
                    <div className={styles.balanceTrack}>
                      <div className={styles.balanceFill} data-negative={cashRemaining < 0}
                           style={{ width: `${activeTrip.cashBudget > 0 ? Math.min((cashSpentLocal / activeTrip.cashBudget) * 100, 100) : 0}%` }} />
                    </div>
                  </div>
                  <div className={styles.balanceCard}>
                    <div className={styles.balanceHead}>
                      <CreditCard className={styles.balanceHeadIcon} />
                      <span className={styles.balanceHeadLabel}>카드 잔여</span>
                    </div>
                    <p className={styles.balanceAmount} data-negative={cardRemaining < 0}>
                      {activeTrip.currencySymbol}{fmtLocal(Math.abs(cardRemaining))}{cardRemaining < 0 ? " 초과" : ""}
                    </p>
                    <p className={styles.balanceSub}>{activeTrip.currencySymbol}{fmtLocal(cardSpentLocal)} / {activeTrip.currencySymbol}{fmtLocal(activeTrip.cardBudget)}</p>
                    <div className={styles.balanceTrack}>
                      <div className={styles.balanceFill} data-negative={cardRemaining < 0}
                           style={{ width: `${activeTrip.cardBudget > 0 ? Math.min((cardSpentLocal / activeTrip.cardBudget) * 100, 100) : 0}%` }} />
                    </div>
                  </div>
                </div>

                {/* 현지 지출 토글 */}
                <div className={styles.card}>
                  <div className={styles.cardHeader} onClick={() => setSpendOpen(!spendOpen)}>
                    <div className={styles.cardHeaderLeft}>
                      <ChevronDown className={styles.chevron} data-open={spendOpen} />
                      <h2 className={styles.cardTitle}>현지 지출</h2>
                    </div>
                    <span className={styles.cardHeaderAmount}>{fmt(activeDate === "all" ? totalSpent : filteredSpent)}원</span>
                  </div>
                  {spendOpen && (
                      <div className={styles.cardBody}>
                        {filteredSpend.length === 0 ? (
                            <div className={styles.empty}>지출 내역이 없습니다.</div>
                        ) : (
                            filteredSpend.map((item) => (
                                <div
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id); }}
                                    onDragOver={(e) => { e.preventDefault(); setDragOverIdx(item.id); }}
                                    onDragLeave={() => setDragOverIdx(null)}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      const fromId = e.dataTransfer.getData("text/plain");
                                      if (fromId !== item.id && activeTrip) {
                                        updateTrip(activeTrip.id, (t) => {
                                          const arr = [...t.spendItems];
                                          const fi = arr.findIndex((x) => x.id === fromId);
                                          const ti = arr.findIndex((x) => x.id === item.id);
                                          if (fi < 0 || ti < 0) return t;
                                          const [m] = arr.splice(fi, 1);
                                          arr.splice(ti, 0, m);
                                          return { ...t, spendItems: arr };
                                        });
                                      }
                                      setDragOverIdx(null);
                                    }}
                                    onDragEnd={() => setDragOverIdx(null)}
                                    className={styles.itemCard}
                                    data-dragover={dragOverIdx === item.id}
                                >
                                  {editingSpendId === item.id && editingSpendData ? (
                                      <div className={styles.inlineForm} style={{ width: "100%", border: "none", padding: 0, margin: 0 }}>
                                        <div className={styles.inlineRow}>
                                          <input type="text" value={editingSpendData.name}
                                                 onChange={(e) => setEditingSpendData((p) => p && ({ ...p, name: e.target.value }))}
                                                 className={styles.inlineInput} style={{ fontSize: "16px" }} />
                                          <input type="number" inputMode="numeric" pattern="[0-9]*"
                                                 value={editingSpendData.amount}
                                                 onChange={(e) => setEditingSpendData((p) => p && ({ ...p, amount: e.target.value }))}
                                                 className={`${styles.inlineInput} ${styles.inlineAmount}`} style={{ fontSize: "16px" }} />
                                        </div>
                                        <div className={styles.inlineRow} style={{ alignItems: "center" }}>
                                          <div style={{ display: "flex", gap: "0.375rem" }}>
                                            {(["LOCAL", "KRW"] as const).map((c) => (
                                                <button key={c} type="button" onClick={() => setEditingSpendData((p) => p && ({ ...p, currency: c }))}
                                                        className={styles.pillBtn} data-active={editingSpendData.currency === c}>
                                                  {c === "LOCAL" ? `${activeTrip.currencySymbol}${activeTrip.currencyCode}` : "₩원"}
                                                </button>
                                            ))}
                                            {editingSpendData.currency === "LOCAL" && (["cash", "card"] as const).map((t) => (
                                                <button key={t} type="button" onClick={() => setEditingSpendData((p) => p && ({ ...p, type: t }))}
                                                        className={styles.pillBtn} data-active={editingSpendData.type === t}>
                                                  {t === "cash" ? "현금" : "카드"}
                                                </button>
                                            ))}
                                          </div>
                                          <div className={styles.inlineActions} style={{ marginLeft: "auto" }}>
                                            <button type="button" onClick={() => {
                                              if (!activeTrip) return;
                                              const amt = parseFloat(editingSpendData.amount);
                                              if (!isNaN(amt) && amt > 0) {
                                                updateTrip(activeTrip.id, (t) => ({
                                                  ...t,
                                                  spendItems: t.spendItems.map((i) => i.id === item.id ? { ...i, name: editingSpendData.name, amount: amt, currency: editingSpendData.currency, type: editingSpendData.type } : i),
                                                }));
                                              }
                                              setEditingSpendId(null); setEditingSpendData(null);
                                            }} className={styles.inlineBtnPrimary}>확인</button>
                                            <button type="button" onClick={() => { setEditingSpendId(null); setEditingSpendData(null); }}
                                                    className={styles.inlineBtnGhost}>취소</button>
                                          </div>
                                        </div>
                                      </div>
                                  ) : (
                                      <>
                                        <div className={styles.itemLeft}>
                                          <span className={styles.itemBadge} data-type={item.type}>{item.type === "cash" ? "현금" : "카드"}</span>
                                          <div className={styles.itemInfo}>
                                            <p className={styles.itemName}>{item.name}</p>
                                            {activeDate === "all" && <p className={styles.itemSub}>{getDayLabel(item.date)}</p>}
                                          </div>
                                        </div>
                                        <div className={styles.itemRight}>
                                          <div className={styles.itemAmountWrap}>
                                            <p className={styles.itemAmount}>
                                              {item.currency === "LOCAL" ? `${activeTrip.currencySymbol}${fmtLocal(item.amount)}` : `${fmt(item.amount)}원`}
                                            </p>
                                            {item.currency === "LOCAL" && (
                                                <p className={styles.itemAmountSub}>≈{fmt(item.amount * activeTrip.exchangeRate)}원</p>
                                            )}
                                          </div>
                                          <div className={styles.itemActions}>
                                            <button onClick={() => { setEditingSpendId(item.id); setEditingSpendData({ name: item.name, amount: String(item.amount), currency: item.currency, type: item.type }); }}
                                                    className={styles.iconBtn}><Edit2 size={13} /></button>
                                            <button onClick={() => activeTrip && updateTrip(activeTrip.id, (t) => ({ ...t, spendItems: t.spendItems.filter((i) => i.id !== item.id) }))}
                                                    className={`${styles.iconBtn} ${styles.iconBtnDelete}`}>
                                              <Trash2 size={13} />
                                            </button>
                                          </div>
                                        </div>
                                      </>
                                  )}
                                </div>
                            ))
                        )}
                      </div>
                  )}
                </div>

                {/* 사전 지출 토글 - 전체 탭에서만 표시 */}
                {activeDate === "all" && <div className={styles.card}>
                  <div className={styles.cardHeader} onClick={() => setFixedOpen(!fixedOpen)}>
                    <div className={styles.cardHeaderLeft}>
                      <ChevronDown className={styles.chevron} data-open={fixedOpen} />
                      <h2 className={styles.cardTitle}>사전 지출</h2>
                    </div>
                    <div className={styles.cardHeaderRight}>
                      <button onClick={(e) => { e.stopPropagation(); setFixedOpen(true); setIsAddingFixed(true); }} className={styles.cardAddBtn}>
                        <Plus size={12} />
                      </button>
                      <span className={styles.cardHeaderAmount}>{fmt(totalFixed)}원</span>
                    </div>
                  </div>
                  {fixedOpen && (
                      <div className={styles.cardBody}>
                        {isAddingFixed && (
                            <div className={styles.inlineForm}>
                              <div className={styles.inlineRow}>
                                <input type="text" value={newFixed.name}
                                       onChange={(e) => setNewFixed((p) => ({ ...p, name: e.target.value }))}
                                       className={styles.inlineInput} placeholder="항목명" lang="ko" autoFocus
                                       style={{ fontSize: "16px" }} />
                                <input type="number" inputMode="numeric" pattern="[0-9]*"
                                       value={newFixed.amount}
                                       onChange={(e) => setNewFixed((p) => ({ ...p, amount: e.target.value }))}
                                       className={`${styles.inlineInput} ${styles.inlineAmount}`} placeholder="금액(원)"
                                       style={{ fontSize: "16px" }}
                                       onKeyDown={(e) => e.key === "Enter" && addFixed()} />
                              </div>
                              <div className={styles.inlineActions}>
                                <button onClick={addFixed} className={styles.inlineBtnPrimary}>추가</button>
                                <button onClick={() => { setIsAddingFixed(false); setNewFixed({ name: "", amount: "" }); }} className={styles.inlineBtnGhost}>취소</button>
                              </div>
                            </div>
                        )}
                        {activeTrip.fixedItems.length === 0 && !isAddingFixed ? (
                            <div className={styles.empty}>등록된 사전 지출이 없습니다.</div>
                        ) : (
                            activeTrip.fixedItems.map((item) => (
                                <div key={item.id} className={styles.itemCard} style={{ cursor: "default" }}>
                                  {editingFixedId === item.id && editingFixedData ? (
                                      <div className={styles.inlineForm} style={{ width: "100%", border: "none", padding: 0, margin: 0 }}>
                                        <div className={styles.inlineRow}>
                                          <input type="text" value={editingFixedData.name}
                                                 onChange={(e) => setEditingFixedData((p) => p && ({ ...p, name: e.target.value }))}
                                                 className={styles.inlineInput} placeholder="항목명" style={{ fontSize: "16px" }} />
                                          <input type="number" inputMode="numeric" pattern="[0-9]*"
                                                 value={editingFixedData.amount}
                                                 onChange={(e) => setEditingFixedData((p) => p && ({ ...p, amount: e.target.value }))}
                                                 className={`${styles.inlineInput} ${styles.inlineAmount}`} placeholder="금액(원)" style={{ fontSize: "16px" }} />
                                        </div>
                                        <div className={styles.inlineActions}>
                                          <button onClick={() => {
                                            if (!activeTrip) return;
                                            const amt = parseInt(editingFixedData.amount, 10);
                                            if (!isNaN(amt) && amt > 0) {
                                              updateTrip(activeTrip.id, (t) => ({
                                                ...t, fixedItems: t.fixedItems.map((i) => i.id === item.id ? { ...i, name: editingFixedData.name, amount: amt } : i),
                                              }));
                                            }
                                            setEditingFixedId(null); setEditingFixedData(null);
                                          }} className={styles.inlineBtnPrimary}>확인</button>
                                          <button onClick={() => { setEditingFixedId(null); setEditingFixedData(null); }} className={styles.inlineBtnGhost}>취소</button>
                                        </div>
                                      </div>
                                  ) : (
                                      <>
                                        <span className={styles.itemName} style={{ flex: 1 }}>{item.name}</span>
                                        <div className={styles.itemRight}>
                                          <span className={styles.itemAmount}>{fmt(item.amount)}원</span>
                                          <div className={styles.itemActions}>
                                            <button onClick={() => { setEditingFixedId(item.id); setEditingFixedData({ name: item.name, amount: String(item.amount) }); }}
                                                    className={styles.iconBtn}><Edit2 size={13} /></button>
                                            <button onClick={() => activeTrip && updateTrip(activeTrip.id, (t) => ({ ...t, fixedItems: t.fixedItems.filter((i) => i.id !== item.id) }))}
                                                    className={`${styles.iconBtn} ${styles.iconBtnDelete}`}>
                                              <Trash2 size={13} />
                                            </button>
                                          </div>
                                        </div>
                                      </>
                                  )}
                                </div>
                            ))
                        )}
                      </div>
                  )}
                </div>}
              </>
          ) : null}
        </main>

        {/* 플로팅 추가 버튼 */}
        {!showList && activeTrip && (
            <button onClick={() => setIsModalOpen(true)} className={styles.fab} title="지출 추가">
              <Plus size={24} />
            </button>
        )}

        {/* 지출 추가 모달 */}
        {isModalOpen && activeTrip && (
            <div className={modalStyles.overlay} onClick={() => setIsModalOpen(false)}>
              <div className={modalStyles.panel} onClick={(e) => e.stopPropagation()}>
                <div className={modalStyles.modalHeader}>
                  <h3 className={modalStyles.modalTitle}>지출 추가</h3>
                  <button onClick={() => setIsModalOpen(false)} className={modalStyles.closeBtn}>
                    <X className={modalStyles.closeIcon} />
                  </button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); addSpend(); }} className={modalStyles.form}>
                  <div>
                    <label className={modalStyles.label}>항목명</label>
                    <input type="text" required value={newSpend.name} onChange={(e) => setNewSpend((p) => ({ ...p, name: e.target.value }))}
                           placeholder="예: 라멘, 편의점 등" lang="ko" autoComplete="off"
                           className={modalStyles.input} style={{ fontSize: "16px" }} />
                  </div>

                  {dates.length > 0 && (
                      <div>
                        <label className={modalStyles.label}>날짜</label>
                        <div className={styles.dateTabs}>
                          {dates.map((d) => (
                              <button key={d} type="button" onClick={() => setNewSpend((p) => ({ ...p, date: d }))}
                                      className={styles.dateTab} data-active={newSpend.date === d}>
                                {getDayLabel(d)}
                              </button>
                          ))}
                        </div>
                      </div>
                  )}

                  <div>
                    <label className={modalStyles.label}>통화</label>
                    <div className={styles.segmentGrid2}>
                      {(["LOCAL", "KRW"] as const).map((c) => (
                          <button key={c} type="button" onClick={() => setNewSpend((p) => ({ ...p, currency: c }))}
                                  className={styles.segmentBtn} data-active={newSpend.currency === c}>
                            {c === "LOCAL" ? `${activeTrip.currencySymbol} ${activeTrip.currencyCode}` : "₩ 원화"}
                          </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={modalStyles.label}>금액 ({newSpend.currency === "LOCAL" ? activeTrip.currencyCode : "원"})</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" required value={newSpend.amount} onChange={(e) => setNewSpend((p) => ({ ...p, amount: e.target.value }))}
                           placeholder={newSpend.currency === "LOCAL" ? `${activeTrip.currencySymbol} 입력` : "₩ 입력"}
                           className={modalStyles.inputMonoNative} style={{ fontSize: "16px" }} />
                    {newSpend.currency === "LOCAL" && newSpend.amount && (
                        <p className={modalStyles.hintSlate}>≈ {fmt(parseFloat(newSpend.amount) * activeTrip.exchangeRate)}원</p>
                    )}
                  </div>

                  {newSpend.currency === "LOCAL" && (
                      <div>
                        <label className={modalStyles.label}>결제 수단</label>
                        <div className={styles.segmentGrid2}>
                          {(["cash", "card"] as const).map((t) => (
                              <button key={t} type="button" onClick={() => setNewSpend((p) => ({ ...p, type: t }))}
                                      className={styles.segmentBtn} data-active={newSpend.type === t}>
                                {t === "cash" ? <><Wallet className={styles.segmentIcon} /> 현금</> : <><CreditCard className={styles.segmentIcon} /> 카드</>}
                              </button>
                          ))}
                        </div>
                      </div>
                  )}

                  <div className={modalStyles.actions}>
                    <button type="button" onClick={() => setIsModalOpen(false)} className={modalStyles.btnCancel}>취소</button>
                    <button type="submit" className={modalStyles.btnSave}><Save className={modalStyles.btnIcon} /> 저장</button>
                  </div>
                </form>
              </div>
            </div>
        )}

        {/* 여행 추가/설정 모달 */}
        {isTripModalOpen && (
            <div className={modalStyles.overlay} onClick={() => setIsTripModalOpen(false)}>
              <div className={modalStyles.panel} onClick={(e) => e.stopPropagation()}>
                <div className={modalStyles.modalHeader}>
                  <h3 className={modalStyles.modalTitle}>{tripModalMode === "create" ? "새 여행" : "여행 설정"}</h3>
                  <button onClick={() => setIsTripModalOpen(false)} className={modalStyles.closeBtn}>
                    <X className={modalStyles.closeIcon} />
                  </button>
                </div>
                <form onSubmit={saveTripDraft} className={modalStyles.form}>
                  <div>
                    <label className={modalStyles.label}>여행 이름</label>
                    <input type="text" required value={tripDraft.name}
                           onChange={(e) => setTripDraft((p) => ({ ...p, name: e.target.value }))}
                           placeholder="예: 오사카 여행" lang="ko" autoComplete="off"
                           className={modalStyles.input} style={{ fontSize: "16px" }} />
                  </div>
                  <div>
                    <label className={modalStyles.label}>나라 <span className={modalStyles.labelOptional}>(선택하면 통화·환율 자동 입력)</span></label>
                    <select
                        value={CURRENCY_PRESETS.some((p) => p.code === tripDraft.currencyCode) ? tripDraft.currencyCode : ""}
                        onChange={(e) => {
                          const preset = CURRENCY_PRESETS.find((p) => p.code === e.target.value);
                          if (preset) {
                            setTripDraft((p) => ({ ...p, currencyCode: preset.code, currencySymbol: preset.symbol, exchangeRate: String(preset.rate) }));
                          }
                        }}
                        className={modalStyles.input} style={{ fontSize: "16px" }}
                    >
                      <option value="">직접 입력</option>
                      {CURRENCY_PRESETS.map((p) => (
                          <option key={p.code} value={p.code}>{p.country} ({p.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className={modalStyles.grid2}>
                    <div>
                      <label className={modalStyles.label}>현지 통화 코드</label>
                      <input type="text" value={tripDraft.currencyCode}
                             onChange={(e) => setTripDraft((p) => ({ ...p, currencyCode: e.target.value.toUpperCase() }))}
                             placeholder="JPY" className={modalStyles.inputMono} style={{ fontSize: "16px" }} />
                    </div>
                    <div>
                      <label className={modalStyles.label}>통화 기호</label>
                      <input type="text" value={tripDraft.currencySymbol}
                             onChange={(e) => setTripDraft((p) => ({ ...p, currencySymbol: e.target.value }))}
                             placeholder="¥" className={modalStyles.inputMono} style={{ fontSize: "16px" }} />
                    </div>
                  </div>
                  <div className={modalStyles.grid2}>
                    <div>
                      <label className={modalStyles.label}>여행 시작일</label>
                      <input type="date" value={tripDraft.startDate}
                             onChange={(e) => setTripDraft((p) => ({ ...p, startDate: e.target.value }))}
                             className={modalStyles.inputMonoNative} style={{ fontSize: "16px" }} />
                    </div>
                    <div>
                      <label className={modalStyles.label}>여행 종료일</label>
                      <input type="date" value={tripDraft.endDate}
                             onChange={(e) => setTripDraft((p) => ({ ...p, endDate: e.target.value }))}
                             className={modalStyles.inputMonoNative} style={{ fontSize: "16px" }} />
                    </div>
                  </div>
                  <div>
                    <label className={modalStyles.label}>환율 ({tripDraft.currencySymbol || "¥"}1 = ?원)</label>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" step="0.1" value={tripDraft.exchangeRate}
                           onChange={(e) => setTripDraft((p) => ({ ...p, exchangeRate: e.target.value }))}
                           className={modalStyles.inputMonoNative} style={{ fontSize: "16px" }} />
                  </div>
                  <div className={modalStyles.grid2}>
                    <div>
                      <label className={modalStyles.label}>현금 예산 ({tripDraft.currencyCode || "JPY"})</label>
                      <input type="number" inputMode="numeric" pattern="[0-9]*" value={tripDraft.cashBudget}
                             onChange={(e) => setTripDraft((p) => ({ ...p, cashBudget: e.target.value }))}
                             className={modalStyles.inputMonoNative} style={{ fontSize: "16px" }} />
                    </div>
                    <div>
                      <label className={modalStyles.label}>카드 예산 ({tripDraft.currencyCode || "JPY"})</label>
                      <input type="number" inputMode="numeric" pattern="[0-9]*" value={tripDraft.cardBudget}
                             onChange={(e) => setTripDraft((p) => ({ ...p, cardBudget: e.target.value }))}
                             className={modalStyles.inputMonoNative} style={{ fontSize: "16px" }} />
                    </div>
                  </div>
                  <div className={modalStyles.actions}>
                    <button type="button" onClick={() => setIsTripModalOpen(false)} className={modalStyles.btnCancel}>취소</button>
                    <button type="submit" className={modalStyles.btnSave}>
                      <Save className={modalStyles.btnIcon} /> {tripModalMode === "create" ? "여행 추가" : "저장"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
        )}
      </div>
  );
}
