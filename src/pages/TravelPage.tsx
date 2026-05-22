import { useState, useEffect, useRef } from "react";
import { Plane, Hotel, Wifi, Shield, Ticket, Plus, Trash2, Wallet, CreditCard, X, ChevronDown, Calendar } from "lucide-react";
import { saveTravelData, loadTravelData, subscribeTravelData } from "../utils/travelFirestore";

interface FixedItem {
  id: string;
  name: string;
  amount: number;
}

interface SpendItem {
  id: string;
  name: string;
  amount: number;
  currency: "KRW" | "JPY";
  type: "cash" | "card";
  date: string;
}

interface Settings {
  exchangeRate: number;
  cashBudget: number;
  cardBudget: number;
  startDate: string;
  endDate: string;
}

const DEFAULT_FIXED: FixedItem[] = [
  { id: "1", name: "비행기", amount: 317120 },
  { id: "2", name: "숙소", amount: 310129 },
  { id: "3", name: "이심", amount: 10780 },
  { id: "4", name: "여행자보험", amount: 10000 },
  { id: "5", name: "디즈니씨", amount: 79600 },
];

const DEFAULT_SETTINGS: Settings = {
  exchangeRate: 9.5,
  cashBudget: 9000,
  cardBudget: 15000,
  startDate: "",
  endDate: "",
};

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
  const [fixedItems, setFixedItems] = useState<FixedItem[]>(DEFAULT_FIXED);
  const [spendItems, setSpendItems] = useState<SpendItem[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeDate, setActiveDate] = useState<string>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return today;
  });
  const [spendOpen, setSpendOpen] = useState(true);
  const [fixedOpen, setFixedOpen] = useState(false);

  const isRemoteUpdate = useRef(false);
  const firestoreUnsub = useRef<(() => void) | null>(null);

  const [newSpend, setNewSpend] = useState({
    name: "", amount: "", currency: "JPY" as "KRW" | "JPY",
    type: "cash" as "cash" | "card", date: new Date().toISOString().slice(0, 10),
  });
  const [rateInput, setRateInput] = useState(String(DEFAULT_SETTINGS.exchangeRate));

  // Firestore
  useEffect(() => {
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    if (isLoading) return;
    const timer = setTimeout(() => {
      saveTravelData({ fixedItems, spendItems, settings }).catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [fixedItems, spendItems, settings, isLoading]);

  useEffect(() => {
    const init = async () => {
      try {
        const remote = await loadTravelData();
        if (remote) {
          isRemoteUpdate.current = true;
          if (remote.fixedItems) setFixedItems(remote.fixedItems);
          if (remote.spendItems) setSpendItems(remote.spendItems);
          if (remote.settings) {
            setSettings(remote.settings);
            setRateInput(String(remote.settings.exchangeRate));
          }
        }
      } catch (e) { console.error(e); }
      finally {
        setIsLoading(false);
        // 오늘 날짜가 여행 기간에 있으면 자동 선택
        const today = new Date().toISOString().slice(0, 10);
        setActiveDate(today);
      }
      firestoreUnsub.current = subscribeTravelData((data) => {
        isRemoteUpdate.current = true;
        if (data.fixedItems) setFixedItems(data.fixedItems);
        if (data.spendItems) setSpendItems(data.spendItems);
        if (data.settings) { setSettings(data.settings); setRateInput(String(data.settings.exchangeRate)); }
      });
    };
    init();
    return () => { if (firestoreUnsub.current) firestoreUnsub.current(); };
  }, []);

  const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
  const fmtYen = (n: number) => Math.round(n).toLocaleString("ja-JP");
  const toKRW = (item: SpendItem) => item.currency === "KRW" ? item.amount : item.amount * settings.exchangeRate;

  const dates = getDates(settings.startDate, settings.endDate);
  const filteredSpend = activeDate === "all" ? spendItems : spendItems.filter((i) => i.date === activeDate);

  const totalFixed = fixedItems.reduce((sum, i) => sum + i.amount, 0);
  const totalSpent = spendItems.reduce((sum, i) => sum + toKRW(i), 0);
  const filteredSpent = filteredSpend.reduce((sum, i) => sum + toKRW(i), 0);
  const grandTotal = totalFixed + totalSpent;

  const cashSpentJPY = spendItems.filter((i) => i.type === "cash" && i.currency === "JPY").reduce((sum, i) => sum + i.amount, 0);
  const cardSpentJPY = spendItems.filter((i) => i.type === "card" && i.currency === "JPY").reduce((sum, i) => sum + i.amount, 0);
  const cashRemaining = settings.cashBudget - cashSpentJPY;
  const cardRemaining = settings.cardBudget - cardSpentJPY;

  const addSpend = () => {
    const amt = parseFloat(newSpend.amount.replace(/,/g, ""));
    if (!newSpend.name || isNaN(amt) || amt <= 0) return;
    setSpendItems((p) => [...p, { id: Date.now().toString(), ...newSpend, amount: amt }]);
    setNewSpend((p) => ({ ...p, name: "", amount: "" }));
    setIsModalOpen(false);
  };

  const saveRate = () => {
    const r = parseFloat(rateInput);
    if (!isNaN(r) && r > 0) setSettings((p) => ({ ...p, exchangeRate: r }));
  };

  const getDayLabel = (date: string) => {
    if (!settings.startDate) return date;
    const start = new Date(settings.startDate);
    const cur = new Date(date);
    const diff = Math.round((cur.getTime() - start.getTime()) / 86400000);
    const [, m, d] = date.split("-");
    return `Day${diff + 1} (${parseInt(m)}/${parseInt(d)})`;
  };

  if (isLoading) {
    return (
        <div className="min-h-screen bg-[#F0F0F0] flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-black uppercase tracking-widest">불러오는 중...</p>
          </div>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-[#F0F0F0] pb-24">
        {/* Header */}
        <header className="bg-white border-b-4 border-black sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">✈️</span>
                <h1 className="text-lg font-extrabold text-black select-none">도쿄 여행 경비</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                    onClick={() => setActiveDate("all")}
                    className={`shrink-0 px-3 py-1.5 text-[10px] font-black border-2 border-black transition-all cursor-pointer ${activeDate === "all" ? "bg-black text-white" : "bg-white text-black hover:bg-slate-100"}`}
                >
                  전체
                </button>
                <button onClick={() => setIsSettingsOpen(true)}
                        className="text-[10px] font-black px-2.5 py-1.5 border-2 border-black bg-white hover:bg-black hover:text-white transition-all cursor-pointer whitespace-nowrap">
                  ⚙️ 설정
                </button>
              </div>
            </div>

            {/* 날짜 탭 */}
            {dates.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">

                  {dates.map((d) => (
                      <button key={d} onClick={() => setActiveDate(d)}
                              className={`shrink-0 px-3 py-1.5 text-[10px] font-black border-2 border-black transition-all cursor-pointer ${activeDate === d ? "bg-black text-white" : "bg-white text-black hover:bg-slate-100"}`}
                      >
                        {getDayLabel(d)}
                      </button>
                  ))}
                </div>
            )}
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 pt-6 space-y-4">

          {/* 총 예상 경비 */}
          <div className="bg-black text-white border-2 border-black p-5 geo-shadow-lg">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              {activeDate === "all" ? "총 예상 경비" : `${getDayLabel(activeDate)} 지출`}
            </p>
            <p className="text-3xl font-black font-mono">
              {activeDate === "all" ? fmt(grandTotal) : fmt(filteredSpent)}원
            </p>
            {activeDate === "all" && (
                <div className="mt-3 pt-3 border-t border-white/20 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-slate-400 font-black uppercase">고정 지출</p>
                    <p className="text-sm font-black font-mono mt-0.5">{fmt(totalFixed)}원</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-black uppercase">현지 지출</p>
                    <p className="text-sm font-black font-mono text-[#E63946] mt-0.5">{fmt(totalSpent)}원</p>
                  </div>
                </div>
            )}
          </div>

          {/* 엔화 잔여 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border-2 border-black p-4 geo-shadow">
              <div className="flex items-center gap-1.5 mb-2">
                <Wallet className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase">현금 잔여</span>
              </div>
              <p className={`text-lg font-black font-mono ${cashRemaining < 0 ? "text-[#E63946]" : "text-black"}`}>
                ¥{fmtYen(Math.abs(cashRemaining))}{cashRemaining < 0 ? " 초과" : ""}
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">¥{fmtYen(cashSpentJPY)} / ¥{fmtYen(settings.cashBudget)}</p>
              <div className="h-1.5 bg-slate-100 border border-black/10 overflow-hidden mt-2">
                <div className={`h-full ${cashRemaining < 0 ? "bg-[#E63946]" : "bg-black"}`}
                     style={{ width: `${Math.min((cashSpentJPY / settings.cashBudget) * 100, 100)}%` }} />
              </div>
            </div>
            <div className="bg-white border-2 border-black p-4 geo-shadow">
              <div className="flex items-center gap-1.5 mb-2">
                <CreditCard className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase">카드 잔여</span>
              </div>
              <p className={`text-lg font-black font-mono ${cardRemaining < 0 ? "text-[#E63946]" : "text-black"}`}>
                ¥{fmtYen(Math.abs(cardRemaining))}{cardRemaining < 0 ? " 초과" : ""}
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">¥{fmtYen(cardSpentJPY)} / ¥{fmtYen(settings.cardBudget)}</p>
              <div className="h-1.5 bg-slate-100 border border-black/10 overflow-hidden mt-2">
                <div className={`h-full ${cardRemaining < 0 ? "bg-[#E63946]" : "bg-black"}`}
                     style={{ width: `${Math.min((cardSpentJPY / settings.cardBudget) * 100, 100)}%` }} />
              </div>
            </div>
          </div>

          {/* 현지 지출 토글 */}
          <div className="bg-white border-2 border-black geo-shadow">
            <div className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-50" onClick={() => setSpendOpen(!spendOpen)}>
              <div className="flex items-center gap-2">
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${spendOpen ? "rotate-0" : "-rotate-90"}`} />
                <h2 className="text-sm font-black uppercase tracking-widest">현지 지출</h2>
              </div>
              <span className="text-sm font-black font-mono text-[#E63946]">
              {fmt(activeDate === "all" ? totalSpent : filteredSpent)}원
            </span>
            </div>
            {spendOpen && (
                <div className="border-t-2 border-black px-5 pb-5 pt-4">
                  {filteredSpend.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs font-medium">// 지출 내역이 없습니다.</div>
                  ) : (
                      <div className="space-y-1">
                        {filteredSpend.map((item) => (
                            <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-black/10 last:border-0">
                              <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 border border-black shrink-0 ${item.type === "cash" ? "bg-black text-white" : "bg-white text-black"}`}>
                          {item.type === "cash" ? "현금" : "카드"}
                        </span>
                                <div className="min-w-0">
                                  <p className="text-xs font-black truncate">{item.name}</p>
                                  {activeDate === "all" && <p className="text-[9px] text-slate-400 font-mono">{getDayLabel(item.date)}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                  <p className="text-xs font-black font-mono">
                                    {item.currency === "JPY" ? `¥${fmtYen(item.amount)}` : `${fmt(item.amount)}원`}
                                  </p>
                                  {item.currency === "JPY" && (
                                      <p className="text-[9px] text-slate-400 font-mono">≈{fmt(item.amount * settings.exchangeRate)}원</p>
                                  )}
                                </div>
                                <button onClick={() => setSpendItems((p) => p.filter((i) => i.id !== item.id))}
                                        className="p-1 hover:bg-[#E63946] hover:text-white border border-black transition-all cursor-pointer">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                        ))}
                      </div>
                  )}
                </div>
            )}
          </div>

          {/* 고정 지출 토글 - 전체 탭에서만 표시 */}
          {activeDate === "all" && <div className="bg-white border-2 border-black geo-shadow">
            <div className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-slate-50" onClick={() => setFixedOpen(!fixedOpen)}>
              <div className="flex items-center gap-2">
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${fixedOpen ? "rotate-0" : "-rotate-90"}`} />
                <h2 className="text-sm font-black uppercase tracking-widest">고정 지출</h2>
              </div>
              <span className="text-sm font-black font-mono text-[#E63946]">{fmt(totalFixed)}원</span>
            </div>
            {fixedOpen && (
                <div className="border-t-2 border-black px-5 pb-5 pt-4 space-y-1">
                  {fixedItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2.5 border-b border-black/10 last:border-0">
                        <span className="text-xs font-black">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black font-mono">{fmt(item.amount)}원</span>
                          <button onClick={() => setFixedItems((p) => p.filter((i) => i.id !== item.id))}
                                  className="p-1 hover:bg-[#E63946] hover:text-white border border-black transition-all cursor-pointer">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                  ))}
                </div>
            )}
          </div>}
        </main>

        {/* 플로팅 추가 버튼 */}
        <button onClick={() => setIsModalOpen(true)}
                className="fixed bottom-6 right-6 z-40 h-14 w-14 bg-black text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#E63946] active:scale-95 transition-all cursor-pointer">
          <Plus className="h-6 w-6" />
        </button>

        {/* 지출 추가 모달 */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75" onClick={() => setIsModalOpen(false)}>
              <div className="bg-white border-4 border-black w-full max-w-sm geo-shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b-4 border-black px-5 py-4">
                  <h2 className="text-sm font-black uppercase tracking-widest">지출 추가</h2>
                  <button onClick={() => setIsModalOpen(false)} className="p-1.5 border-2 border-black hover:bg-[#E63946] hover:text-white transition-all cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-black mb-1.5">항목명</label>
                    <input type="text" value={newSpend.name} onChange={(e) => setNewSpend((p) => ({ ...p, name: e.target.value }))}
                           placeholder="예: 라멘, 편의점 등" lang="ko"
                           className="w-full h-11 border-2 border-black px-3 text-sm font-bold outline-none focus:border-[#E63946]" />
                  </div>

                  {/* 날짜 */}
                  {dates.length > 0 && (
                      <div>
                        <label className="block text-xs font-black mb-1.5">날짜</label>
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {dates.map((d) => (
                              <button key={d} onClick={() => setNewSpend((p) => ({ ...p, date: d }))}
                                      className={`shrink-0 px-2.5 py-1.5 text-[10px] font-black border-2 border-black transition-all cursor-pointer ${newSpend.date === d ? "bg-black text-white" : "bg-white text-black"}`}>
                                {getDayLabel(d)}
                              </button>
                          ))}
                        </div>
                      </div>
                  )}

                  <div>
                    <label className="block text-xs font-black mb-1.5">통화</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["JPY", "KRW"] as const).map((c) => (
                          <button key={c} onClick={() => setNewSpend((p) => ({ ...p, currency: c }))}
                                  className={`py-2.5 text-sm font-black border-2 border-black transition-all cursor-pointer ${newSpend.currency === c ? "bg-black text-white" : "bg-white hover:bg-slate-100"}`}>
                            {c === "JPY" ? "¥ 엔화" : "₩ 원화"}
                          </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black mb-1.5">금액 ({newSpend.currency === "JPY" ? "엔" : "원"})</label>
                    <input type="number" value={newSpend.amount} onChange={(e) => setNewSpend((p) => ({ ...p, amount: e.target.value }))}
                           placeholder={newSpend.currency === "JPY" ? "¥ 입력" : "₩ 입력"}
                           className="w-full h-11 border-2 border-black px-3 text-sm font-bold font-mono outline-none focus:border-[#E63946]"
                           onKeyDown={(e) => e.key === "Enter" && addSpend()} />
                    {newSpend.currency === "JPY" && newSpend.amount && (
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          ≈ {fmt(parseFloat(newSpend.amount) * settings.exchangeRate)}원
                        </p>
                    )}
                  </div>

                  {newSpend.currency === "JPY" && (
                      <div>
                        <label className="block text-xs font-black mb-1.5">결제 수단</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["cash", "card"] as const).map((t) => (
                              <button key={t} onClick={() => setNewSpend((p) => ({ ...p, type: t }))}
                                      className={`py-2.5 text-xs font-black border-2 border-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${newSpend.type === t ? "bg-black text-white" : "bg-white hover:bg-slate-100"}`}>
                                {t === "cash" ? <><Wallet className="h-3.5 w-3.5" /> 현금</> : <><CreditCard className="h-3.5 w-3.5" /> 카드</>}
                              </button>
                          ))}
                        </div>
                      </div>
                  )}

                  <button onClick={addSpend}
                          className="w-full h-12 bg-black text-white text-sm font-black border-2 border-black hover:bg-[#E63946] transition-all cursor-pointer active:translate-y-0.5">
                    저장
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* 설정 모달 */}
        {isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75" onClick={() => setIsSettingsOpen(false)}>
              <div className="bg-white border-4 border-black w-full max-w-sm geo-shadow-lg" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b-4 border-black px-5 py-4">
                  <h2 className="text-sm font-black uppercase tracking-widest">설정</h2>
                  <button onClick={() => setIsSettingsOpen(false)} className="p-1.5 border-2 border-black hover:bg-[#E63946] hover:text-white transition-all cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-black mb-1.5">여행 시작일</label>
                    <input type="date" value={settings.startDate}
                           onChange={(e) => setSettings((p) => ({ ...p, startDate: e.target.value }))}
                           className="w-full h-11 border-2 border-black px-3 font-bold outline-none focus:border-[#E63946]" style={{fontSize: "16px"}} />
                  </div>
                  <div>
                    <label className="block text-xs font-black mb-1.5">여행 종료일</label>
                    <input type="date" value={settings.endDate}
                           onChange={(e) => setSettings((p) => ({ ...p, endDate: e.target.value }))}
                           className="w-full h-11 border-2 border-black px-3 font-bold outline-none focus:border-[#E63946]" style={{fontSize: "16px"}} />
                  </div>
                  <div>
                    <label className="block text-xs font-black mb-1.5">환율 (¥1 = ?원)</label>
                    <input type="number" step="0.1" value={rateInput}
                           onChange={(e) => setRateInput(e.target.value)}
                           onBlur={saveRate}
                           className="w-full h-11 border-2 border-black px-3 text-sm font-bold font-mono outline-none focus:border-[#E63946]" />
                  </div>
                  <div>
                    <label className="block text-xs font-black mb-1.5">현금 예산 (엔)</label>
                    <input type="number" value={settings.cashBudget}
                           onChange={(e) => setSettings((p) => ({ ...p, cashBudget: parseInt(e.target.value) || 0 }))}
                           className="w-full h-11 border-2 border-black px-3 text-sm font-bold font-mono outline-none focus:border-[#E63946]" />
                  </div>
                  <div>
                    <label className="block text-xs font-black mb-1.5">카드 예산 (엔)</label>
                    <input type="number" value={settings.cardBudget}
                           onChange={(e) => setSettings((p) => ({ ...p, cardBudget: parseInt(e.target.value) || 0 }))}
                           className="w-full h-11 border-2 border-black px-3 text-sm font-bold font-mono outline-none focus:border-[#E63946]" />
                  </div>
                  <button onClick={() => setIsSettingsOpen(false)}
                          className="w-full h-12 bg-black text-white text-sm font-black border-2 border-black hover:bg-[#E63946] transition-all cursor-pointer">
                    저장
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}