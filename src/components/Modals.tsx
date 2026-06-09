import React, { useState, useEffect } from "react";
import { X, HelpCircle, Save } from "lucide-react";
import { ExpenseItem, FixedExpense, BudgetCycle, EventExpense, IncomeItem, InstallmentItem, DebtItem } from "../types";

// ==========================================
// 1. EXPENSE ADD / EDIT MODAL
// ==========================================
interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: ExpenseItem) => void;
  initialItem?: ExpenseItem | null;
  defaultMonthStr?: string;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
                                                            isOpen,
                                                            onClose,
                                                            onSave,
                                                            initialItem,
                                                            defaultMonthStr,
                                                          }) => {
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (initialItem) {
      setDate(initialItem.date);
      setName(initialItem.name);
      setAmount(String(initialItem.amount));
    } else {
      const today = new Date();
      const yr = today.getFullYear();
      const mo = String(today.getMonth() + 1).padStart(2, "0");
      const dy = String(today.getDate()).padStart(2, "0");
      const todayStr = `${yr}-${mo}-${dy}`;

      if (defaultMonthStr) {
        if (todayStr.startsWith(defaultMonthStr)) {
          setDate(todayStr);
        } else {
          // Default to the first day of the selected month
          setDate(`${defaultMonthStr}-01`);
        }
      } else {
        setDate(todayStr);
      }
      setName("");
      setAmount("");
    }
  }, [initialItem, isOpen, defaultMonthStr]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseInt(amount, 10);
    if (!date || !name.trim() || isNaN(amtNum) || amtNum <= 0) return;
    onSave({
      date,
      name: name.trim(),
      amount: amtNum,
      editable: true,
      checked: initialItem ? initialItem.checked : true,
      paid: initialItem ? initialItem.paid : false,
    });
    onClose();
  };

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} onTouchMove={(e) => e.stopPropagation()}>
        <div className="bg-white border-4 border-black rounded-none p-6 w-full max-w-sm geo-shadow-lg" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b-2 border-black pb-3.5 mb-5">
            <h3 className="text-sm font-black text-black">
              {initialItem ? "지출 수정" : "지출 추가"}
            </h3>
            <button onClick={onClose} className="p-1.5 bg-white border-2 border-black text-black hover:bg-[#E63946] hover:text-white rounded-none cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-black mb-1.5">날짜</label>
              <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none appearance-none"
                  style={{ fontSize: "16px" }}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-black mb-1.5">항목명</label>
              <input
                  type="text"
                  required
                  placeholder="예: 다이소 수납함, 스타벅스 커피 등"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  inputMode="text"
                  lang="ko"
                  autoComplete="off"
                  className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold text-black outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-black mb-1.5">금액</label>
              <input
                  type="number"
                  required
                  min="1"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 bg-white hover:bg-slate-100 text-xs text-black font-black uppercase tracking-wider border-2 border-black rounded-none cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                취소
              </button>
              <button
                  type="submit"
                  className="flex-1 h-11 bg-black hover:bg-[#E63946] text-xs text-white font-black uppercase tracking-wider border-2 border-black rounded-none flex items-center justify-center gap-1 cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                <Save className="h-4 w-4" /> 저장
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};


// ==========================================
// 2. FIXED EXPENSE ADD MODAL
// ==========================================
interface FixedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: FixedExpense) => void;
  initialItem?: FixedExpense | null;
  editingIdx?: number | null;
}

export const FixedModal: React.FC<FixedModalProps> = ({ isOpen, onClose, onSave, initialItem, editingIdx }) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (initialItem) {
        setName(initialItem.name);
        setAmount(String(initialItem.amount));
        setDay(initialItem.day ? initialItem.day.replace(/[^0-9]/g, "") : "");
      } else {
        setName("");
        setAmount("");
        setDay("");
      }
    }
  }, [isOpen, initialItem]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseInt(amount, 10);
    if (!name.trim() || isNaN(amtNum) || amtNum <= 0) return;
    onSave({
      name: name.trim(),
      amount: amtNum,
      day: day ? `매달 ${day}일` : "날짜 미정",
    });
    onClose();
  };

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
        <div className="bg-white border-4 border-black rounded-none p-6 w-full max-w-sm geo-shadow-lg">
          <div className="flex items-center justify-between border-b-2 border-black pb-3.5 mb-5">
            <h3 className="text-sm font-black text-black">{initialItem ? "고정 지출 수정" : "고정 지출 추가"}</h3>
            <button onClick={onClose} className="p-1.5 bg-white border-2 border-black text-black hover:bg-[#E63946] hover:text-white rounded-none cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-black mb-1.5">지출 명칭</label>
              <input
                  type="text"
                  required
                  placeholder="예: 통신비, 유튜브 구독, 피트니스 등"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold text-black outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-black mb-1.5">금액</label>
              <input
                  type="number"
                  required
                  min="1"
                  placeholder="예: 55000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-black mb-1.5">매월 출금일</label>
              <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="예: 25"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none"
              />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5 block">※ 빈칸 설정 시 &apos;날짜 미정&apos;으로 지정.</span>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 bg-white hover:bg-slate-100 text-xs text-black font-black uppercase tracking-wider border-2 border-black rounded-none cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                취소
              </button>
              <button
                  type="submit"
                  className="flex-1 h-11 bg-black hover:bg-[#E63946] text-xs text-white font-black uppercase tracking-wider border-2 border-black rounded-none flex items-center justify-center gap-1 cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                저장
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};


// ==========================================
// 3. MONTH ADD MODAL
// ==========================================
interface MonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (year: number, month: number, budget: number) => void;
}

export const MonthModal: React.FC<MonthModalProps> = ({ isOpen, onClose, onSave }) => {
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [budget, setBudget] = useState("600000");

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      setYear(String(today.getFullYear()));
      setMonth(String(today.getMonth() + 2 > 12 ? 1 : today.getMonth() + 2));
      setBudget("600000");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const yrNum = parseInt(year, 10);
    const moNum = parseInt(month, 10);
    const bgNum = parseInt(budget, 10) || 600000;
    if (isNaN(yrNum) || isNaN(moNum) || moNum < 1 || moNum > 12) return;
    onSave(yrNum, moNum, bgNum);
    onClose();
  };

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
        <div className="bg-white border-4 border-black rounded-none p-6 w-full max-w-sm geo-shadow-lg">
          <div className="flex items-center justify-between border-b-2 border-black pb-3.5 mb-5">
            <h3 className="text-sm font-black text-black">새로운 지출월 추가</h3>
            <button onClick={onClose} className="p-1.5 bg-white border-2 border-black text-black hover:bg-[#E63946] hover:text-white rounded-none cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-black text-black mb-1.5">연도</label>
                <input
                    type="number"
                    required
                    min="2020"
                    max="2099"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-black mb-1.5">월</label>
                <input
                    type="number"
                    required
                    min="1"
                    max="12"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-black mb-1.5">생활비 총예산</label>
              <input
                  type="number"
                  required
                  min="0"
                  placeholder="600000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 bg-white hover:bg-slate-100 text-xs text-black font-black uppercase tracking-wider border-2 border-black rounded-none cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                취소
              </button>
              <button
                  type="submit"
                  className="flex-1 h-11 bg-black hover:bg-[#E63946] text-xs text-white font-black uppercase tracking-wider border-2 border-black rounded-none flex items-center justify-center gap-1 cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                추가하기
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};


// ==========================================
// 4. BUDGET CYCLE EDIT MODAL
// ==========================================
interface CycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cycle: BudgetCycle) => void;
  initialCycle: BudgetCycle | null;
}

export const CycleModal: React.FC<CycleModalProps> = ({
                                                        isOpen,
                                                        onClose,
                                                        onSave,
                                                        initialCycle,
                                                      }) => {
  const [label, setLabel] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [budget, setBudget] = useState("");

  const getCleanLabel = (val: string) => {
    return val.replace(/\s*\(.*?\)\s*/g, "").trim();
  };

  useEffect(() => {
    if (initialCycle) {
      setLabel(getCleanLabel(initialCycle.label));
      setStart(initialCycle.start);
      setEnd(initialCycle.end);
      setBudget(String(initialCycle.budget));
    }
  }, [initialCycle, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bgNum = parseInt(budget, 10);
    if (!label.trim() || !start || !end || isNaN(bgNum) || bgNum < 0) return;
    onSave({
      label: label.trim(),
      start,
      end,
      budget: bgNum,
    });
    onClose();
  };

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
        <div className="bg-white border-4 border-black rounded-none p-6 w-full max-w-sm geo-shadow-lg">
          <div className="flex items-center justify-between border-b-2 border-black pb-3.5 mb-5">
            <h3 className="text-sm font-black text-black">소비 주기 설정 변경</h3>
            <button onClick={onClose} className="p-1.5 bg-white border-2 border-black text-black hover:bg-[#E63946] hover:text-white rounded-none cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-black mb-1.5">주기 구분 명칭</label>
              <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold text-black outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-black text-black mb-1.5">시작</label>
                <input
                    type="date"
                    required
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-2 text-xs font-bold font-mono text-black outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-black mb-1.5">종료</label>
                <input
                    type="date"
                    required
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-2 text-xs font-bold font-mono text-black outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-black mb-1.5">주기 배정 예산</label>
              <input
                  type="number"
                  required
                  min="0"
                  placeholder="0"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none"
              />
              <span className="text-[10px] text-[#E63946] font-bold uppercase tracking-wider mt-1.5 block">※ 이 주기에 배당할 전용 소비 한도입니다.</span>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 bg-white hover:bg-slate-100 text-xs text-black font-black uppercase tracking-wider border-2 border-black rounded-none cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                취소
              </button>
              <button
                  type="submit"
                  className="flex-1 h-11 bg-black hover:bg-[#E63946] text-xs text-white font-black uppercase tracking-wider border-2 border-black rounded-none flex items-center justify-center gap-1 cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                저장
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};


// ==========================================
// 5. FAMILY/SPECIAL EVENT EXPENSE ADD MODAL
// ==========================================
interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: EventExpense) => void;
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName("");
      setAmount("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseInt(amount, 10);
    if (!name.trim() || isNaN(amtNum) || amtNum <= 0) return;
    onSave({
      name: name.trim(),
      amount: amtNum,
    });
    onClose();
  };

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
        <div className="bg-white border-4 border-black rounded-none p-6 w-full max-w-sm geo-shadow-lg">
          <div className="flex items-center justify-between border-b-2 border-black pb-3.5 mb-5">
            <h3 className="text-sm font-black text-black">경조사비 추가</h3>
            <button onClick={onClose} className="p-1.5 bg-white border-2 border-black text-black hover:bg-[#E63946] hover:text-white rounded-none cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-black mb-1.5">경조사명</label>
              <input
                  type="text"
                  required
                  placeholder="예: 어버이날 용돈, 지인 결혼식 등"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold text-black outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-black mb-1.5">금액</label>
              <input
                  type="number"
                  required
                  min="1"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 bg-white hover:bg-slate-100 text-xs text-black font-black uppercase tracking-wider border-2 border-black rounded-none cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                취소
              </button>
              <button
                  type="submit"
                  className="flex-1 h-11 bg-black hover:bg-[#E63946] text-xs text-white font-black uppercase tracking-wider border-2 border-black rounded-none flex items-center justify-center gap-1 cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                <Save className="h-4 w-4" /> 저장
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};
// ===================== INCOME MODAL =====================
interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: IncomeItem) => void;
  cycles: { label: string }[];
  initialItem?: IncomeItem | null;
}

export const IncomeModal: React.FC<IncomeModalProps> = ({ isOpen, onClose, onSave, cycles, initialItem }) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycleIdx, setCycleIdx] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (initialItem) {
        setName(initialItem.name);
        setAmount(String(initialItem.amount));
        setCycleIdx(initialItem.cycleIdx);
      } else {
        setName("");
        setAmount("");
        setCycleIdx(0);
      }
    }
  }, [isOpen, initialItem]);

  const handleSave = () => {
    const amt = parseInt(amount.replace(/,/g, ""), 10);
    if (!name.trim() || isNaN(amt) || amt <= 0) return;
    onSave({
      id: initialItem?.id || Date.now().toString(),
      name: name.trim(),
      amount: amt,
      cycleIdx,
    });
    onClose();
  };

  if (!isOpen) return null;

  const getCleanLabel = (label: string) => label.replace(/\s*\(.*?\)\s*/g, "").trim();

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
           onClick={onClose}>
        <div className="bg-white border-4 border-black w-full max-w-sm geo-shadow-lg"
             onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b-4 border-black px-5 py-4">
            <h3 className="text-sm font-black text-black">{initialItem ? "수입 수정" : "추가 수입"}</h3>
            <button onClick={onClose} className="p-1.5 bg-white border-2 border-black hover:bg-[#E63946] hover:text-white cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-black mb-1.5">수입 내용</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                     placeholder="예: 부업 수입, 환급금 등"
                     lang="ko" inputMode="text"
                     className="w-full h-11 border-2 border-black px-3 font-bold outline-none focus:border-[#E63946]"
                     style={{ fontSize: "16px" }} />
            </div>
            <div>
              <label className="block text-xs font-black mb-1.5">금액 (원)</label>
              <input type="number" inputMode="numeric" pattern="[0-9]*"
                     value={amount} onChange={(e) => setAmount(e.target.value)}
                     placeholder="0"
                     className="w-full h-11 border-2 border-black px-3 font-bold font-mono outline-none focus:border-[#E63946]"
                     style={{ fontSize: "16px" }}
                     onKeyDown={(e) => e.key === "Enter" && handleSave()} />
            </div>
            <div>
              <label className="block text-xs font-black mb-1.5">적용 주기</label>
              <div className="flex flex-col gap-2">
                {cycles.map((c, i) => (
                    <button key={i} onClick={() => setCycleIdx(i)}
                            className={`w-full py-2.5 text-xs font-black border-2 border-black transition-all cursor-pointer ${cycleIdx === i ? "bg-black text-white" : "bg-white text-black hover:bg-slate-100"}`}>
                      {getCleanLabel(c.label)}
                    </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={onClose}
                      className="flex-1 h-11 bg-white text-black text-xs font-black border-2 border-black hover:bg-slate-100 cursor-pointer">
                취소
              </button>
              <button onClick={handleSave}
                      className="flex-1 h-11 bg-black text-white text-xs font-black border-2 border-black hover:bg-[#E63946] cursor-pointer">
                저장
              </button>
            </div>
          </div>
        </div>
      </div>
  );
};

// ==========================================
// 6. INSTALLMENT (할부) ADD / EDIT MODAL
// ==========================================
interface InstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: InstallmentItem) => void;
  initialItem?: InstallmentItem | null;
  defaultMonthStr?: string; // "YYYY-MM"
}

export const InstallmentModal: React.FC<InstallmentModalProps> = ({
                                                                    isOpen,
                                                                    onClose,
                                                                    onSave,
                                                                    initialItem,
                                                                    defaultMonthStr,
                                                                  }) => {
  const [name, setName] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [months, setMonths] = useState("");
  const [total, setTotal] = useState("");
  const [monthly, setMonthly] = useState("");
  // 월 납부액을 사용자가 직접 손댔는지 여부 (손대면 자동 계산 멈춤)
  const [monthlyEdited, setMonthlyEdited] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialItem) {
      setName(initialItem.name);
      setStartMonth(initialItem.startMonth);
      setMonths(String(initialItem.months));
      setTotal(String(initialItem.totalAmount));
      setMonthly(String(initialItem.monthlyAmount));
      // 자동값과 다르면 수동 편집된 것으로 간주
      const auto = initialItem.months > 0 ? Math.round(initialItem.totalAmount / initialItem.months) : 0;
      setMonthlyEdited(initialItem.monthlyAmount !== auto);
    } else {
      const fallback = defaultMonthStr || new Date().toISOString().slice(0, 7);
      setName("");
      setStartMonth(fallback);
      setMonths("");
      setTotal("");
      setMonthly("");
      setMonthlyEdited(false);
    }
  }, [isOpen, initialItem, defaultMonthStr]);

  // 총액·개월 변경 시 월 납부액 자동 계산 (사용자가 직접 수정하지 않은 경우에만)
  useEffect(() => {
    if (monthlyEdited) return;
    const t = parseInt(total, 10);
    const m = parseInt(months, 10);
    if (!isNaN(t) && !isNaN(m) && m > 0) {
      setMonthly(String(Math.round(t / m)));
    } else {
      setMonthly("");
    }
  }, [total, months, monthlyEdited]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const m = parseInt(months, 10);
    const t = parseInt(total, 10);
    const mo = parseInt(monthly, 10);
    if (!name.trim() || !startMonth || isNaN(m) || m <= 0 || isNaN(t) || t <= 0 || isNaN(mo) || mo <= 0) return;
    onSave({
      id: initialItem?.id || Date.now().toString(),
      name: name.trim(),
      startMonth,
      months: m,
      totalAmount: t,
      monthlyAmount: mo,
    });
    onClose();
  };

  const inputCls =
      "w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold text-black outline-none";
  const monoCls = inputCls + " font-mono";

  // 미리보기용 종료 월
  const endLabel = (() => {
    if (!startMonth) return "";
    const m = parseInt(months, 10);
    if (isNaN(m) || m <= 0) return "";
    const [y, mo] = startMonth.split("-").map(Number);
    const idx = y * 12 + (mo - 1) + (m - 1);
    const ey = Math.floor(idx / 12);
    const em = (idx % 12) + 1;
    return `${ey}-${String(em).padStart(2, "0")}`;
  })();

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
           onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white border-4 border-black rounded-none p-6 w-full max-w-sm geo-shadow-lg"
             onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b-2 border-black pb-3.5 mb-5">
            <h3 className="text-sm font-black text-black">{initialItem ? "할부 수정" : "할부 추가"}</h3>
            <button onClick={onClose} className="p-1.5 bg-white border-2 border-black text-black hover:bg-[#E63946] hover:text-white rounded-none cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-black mb-1.5">항목명</label>
              <input
                  type="text"
                  required
                  placeholder="예: 노트북, 냉장고 할부 등"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  lang="ko"
                  autoComplete="off"
                  className={inputCls}
                  style={{ fontSize: "16px" }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-black mb-1.5">시작 월</label>
                <input
                    type="month"
                    required
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    className={monoCls + " appearance-none"}
                    style={{ fontSize: "16px" }}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-black mb-1.5">개월 수</label>
                <input
                    type="number"
                    required
                    min="1"
                    placeholder="예: 6"
                    value={months}
                    onChange={(e) => setMonths(e.target.value)}
                    className={monoCls}
                    style={{ fontSize: "16px" }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-black mb-1.5">총 결제금액</label>
              <input
                  type="number"
                  required
                  min="1"
                  placeholder="0"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className={monoCls}
                  style={{ fontSize: "16px" }}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-black mb-1.5 flex justify-between items-center">
                <span>월 납부액</span>
                <span className="text-[10px] text-slate-500 font-bold">자동 계산 · 수정 가능</span>
              </label>
              <input
                  type="number"
                  required
                  min="1"
                  placeholder="0"
                  value={monthly}
                  onChange={(e) => { setMonthly(e.target.value); setMonthlyEdited(true); }}
                  className={monoCls}
                  style={{ fontSize: "16px" }}
              />
              {monthlyEdited && (
                  <button
                      type="button"
                      onClick={() => setMonthlyEdited(false)}
                      className="mt-1.5 text-[10px] font-black text-slate-500 underline hover:text-[#E63946] cursor-pointer"
                  >
                    ↻ 자동 계산으로 되돌리기
                  </button>
              )}
            </div>

            {startMonth && endLabel && (
                <div className="bg-[#F0F0F0] border-2 border-black px-3 py-2 text-[10px] font-black text-black font-mono">
                  {startMonth} ~ {endLabel} 매달 반영
                </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 bg-white hover:bg-slate-100 text-xs text-black font-black uppercase tracking-wider border-2 border-black rounded-none cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                취소
              </button>
              <button
                  type="submit"
                  className="flex-1 h-11 bg-black hover:bg-[#E63946] text-xs text-white font-black uppercase tracking-wider border-2 border-black rounded-none flex items-center justify-center gap-1 cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                <Save className="h-4 w-4" /> 저장
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};

// ==========================================
// 7. DEBT (당겨쓰기) ADD / EDIT MODAL
// ==========================================

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: DebtItem) => void;
  initialItem?: DebtItem | null;
  defaultMonthStr?: string;
}

export const DebtModal: React.FC<DebtModalProps> = ({
                                                      isOpen,
                                                      onClose,
                                                      onSave,
                                                      initialItem,
                                                      defaultMonthStr,
                                                    }) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [targetMonth, setTargetMonth] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const fallback = defaultMonthStr || new Date().toISOString().slice(0, 7);
    if (initialItem) {
      setName(initialItem.name);
      setAmount(String(initialItem.amount));
      setFromMonth(initialItem.fromMonth);
      setTargetMonth(initialItem.targetMonth);
    } else {
      setName("");
      setAmount("");
      // fromMonth 기본값: targetMonth 의 전달
      const [y, m] = fallback.split("-").map(Number);
      const prevIdx = y * 12 + (m - 1) - 1;
      const py = Math.floor(prevIdx / 12);
      const pm = (prevIdx % 12) + 1;
      setFromMonth(`${py}-${String(pm).padStart(2, "0")}`);
      setTargetMonth(fallback);
    }
  }, [isOpen, initialItem, defaultMonthStr]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseInt(amount, 10);
    if (!name.trim() || isNaN(amt) || amt <= 0 || !fromMonth || !targetMonth) return;
    onSave({
      id: initialItem?.id || Date.now().toString(),
      name: name.trim(),
      amount: amt,
      fromMonth,
      targetMonth,
    });
    onClose();
  };

  const inputCls =
      "w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold text-black outline-none";
  const monoCls = inputCls + " font-mono";

  return (
      <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
            className="bg-white border-4 border-black rounded-none p-6 w-full max-w-sm geo-shadow-lg"
            onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b-2 border-black pb-3.5 mb-5">
            <h3 className="text-sm font-black text-black flex items-center gap-2">
              🔴 {initialItem ? "당겨쓰기 수정" : "당겨쓰기 추가"}
            </h3>
            <button
                onClick={onClose}
                className="p-1.5 bg-white border-2 border-black text-black hover:bg-[#E63946] hover:text-white rounded-none cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-[10px] font-bold text-slate-500 bg-[#F0F0F0] border-2 border-black px-3 py-2 mb-4 leading-relaxed">
            지난달 초과 지출 등 이번 달 생활비 예산에서 갚아야 할 금액을 등록합니다.<br />
            총예산 자동 분배 시 이 금액도 생활비에서 자동 차감됩니다.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-black mb-1.5">메모</label>
              <input
                  type="text"
                  required
                  placeholder="예: 5월 생활비 초과분, 친구 빌린 돈"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  lang="ko"
                  autoComplete="off"
                  className={inputCls}
                  style={{ fontSize: "16px" }}
              />
            </div>

            <div>
              <label className="block text-xs font-black text-black mb-1.5">금액</label>
              <input
                  type="number"
                  required
                  min="1"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={monoCls}
                  style={{ fontSize: "16px" }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-black mb-1.5">발생 월</label>
                <input
                    type="month"
                    required
                    value={fromMonth}
                    onChange={(e) => setFromMonth(e.target.value)}
                    className={monoCls + " appearance-none"}
                    style={{ fontSize: "16px" }}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-black mb-1.5">차감 월</label>
                <input
                    type="month"
                    required
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className={monoCls + " appearance-none"}
                    style={{ fontSize: "16px" }}
                />
              </div>
            </div>

            {fromMonth && targetMonth && (
                <div className="bg-black text-white px-3 py-2 text-[10px] font-black font-mono">
                  {fromMonth}에 발생 → {targetMonth} 예산에서 차감
                </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 bg-white hover:bg-slate-100 text-xs text-black font-black uppercase tracking-wider border-2 border-black rounded-none cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                취소
              </button>
              <button
                  type="submit"
                  className="flex-1 h-11 bg-black hover:bg-[#E63946] text-xs text-white font-black uppercase tracking-wider border-2 border-black rounded-none flex items-center justify-center gap-1 cursor-pointer geo-shadow-sm active:translate-y-0.5"
              >
                <Save className="h-4 w-4" /> 저장
              </button>
            </div>
          </form>
        </div>
      </div>
  );
};