import React, { useState, useEffect } from "react";
import { X, HelpCircle, Save } from "lucide-react";
import { ExpenseItem, FixedExpense, BudgetCycle, EventExpense } from "../types";

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
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="bg-white border-4 border-black rounded-none p-6 w-full max-w-sm geo-shadow-lg">
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
              className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none"
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
}

export const FixedModal: React.FC<FixedModalProps> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName("");
      setAmount("");
      setDay("");
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
      day: day ? `매달 ${day}일` : "날짜 미정",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="bg-white border-4 border-black rounded-none p-6 w-full max-w-sm geo-shadow-lg">
        <div className="flex items-center justify-between border-b-2 border-black pb-3.5 mb-5">
          <h3 className="text-sm font-black text-black">고정 지출 추가</h3>
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

