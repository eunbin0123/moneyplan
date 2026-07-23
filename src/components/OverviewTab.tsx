import React, { useState, useEffect } from "react";
import { MonthData, InstallmentItem, DebtItem } from "../types";
import { BookOpen } from "lucide-react";
import styles from "../css/OverviewTab.module.css";
import { getPayday, isSameDay } from "../utils/payday";

function PaydayCountdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const thisPay = getPayday(now.getFullYear(), now.getMonth());

  if (isSameDay(now, thisPay)) {
    return <div className={styles.paydayToday}>오늘 월급날 🎉</div>;
  }

  let target = thisPay;
  if (now.getTime() >= thisPay.getTime()) {
    const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    target = getPayday(nm.getFullYear(), nm.getMonth());
  }

  const dDay = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
      <div className={styles.paydayCountdown}>
        <span style={{ fontSize: "0.6875rem", color: "var(--c-text-faint)", fontWeight: 500 }}>월급까지</span>
        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--c-green)", fontVariantNumeric: "tabular-nums" }}>
        {dDay === 0 ? "D-DAY" : `D-${dDay}`}
      </span>
      </div>
  );
}

interface OverviewTabProps {
  data: MonthData;
  activeMonth: string;
  onEditCycle: (idx: number) => void;
  onOpenMemo: () => void;
  onOpenSavings: () => void;
  onOpenDashboard: () => void;
  installments?: InstallmentItem[];
  debts?: DebtItem[];
  rawCycles?: import('../types').BudgetCycle[];
  dayMemos?: Record<string, string>;
  onUpdateDayMemo?: (date: string, memo: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
                                                          data, activeMonth, onEditCycle, onOpenMemo,
                                                          installments = [], debts = [],
                                                          dayMemos = {}, onUpdateDayMemo,
                                                        }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const formatCurrency = (amount: number) => Math.round(amount).toLocaleString("ko-KR") + "원";
  const fmtShort = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 10000) return `${(n / 10000).toFixed(1)}만`;
    return n.toLocaleString("ko-KR");
  };

  const dlabel = (dateStr: string) => {
    const p = dateStr.split("-");
    return p.length >= 3 ? `${parseInt(p[1])}/${parseInt(p[2])}` : dateStr;
  };
  const getCleanLabel = (label: string) => label.replace(/\s*\(.*?\)\s*/g, "").trim();
  const getLevel = (pct: number) => pct >= 100 ? "over" : pct >= 80 ? "warn" : "normal";

  const monthIdx = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return y * 12 + (m - 1);
  };

  // 계산
  const salary = data.salary ?? 0;
  const carryFromPrevMonth = data.carryFromPrevMonth ?? 0;
  const totalIncome = (data.incomes || []).reduce((s, i) => s + i.amount, 0);
  const fixedAccountsTotal = (data.accounts || []).slice(0, -1).reduce((s, a) => s + a.amount, 0);
  const installmentChargeThisMonth = (installments || []).reduce((s, it) => {
    const start = monthIdx(it.startMonth), cur = monthIdx(activeMonth);
    return s + (cur >= start && cur < start + it.months ? it.monthlyAmount : 0);
  }, 0);
  const debtChargeThisMonth = (debts || []).reduce((s, d) => s + d.amount, 0);
  const baseLivingBudget = salary > 0
      ? Math.max(0, salary - fixedAccountsTotal - installmentChargeThisMonth - debtChargeThisMonth)
      : (data.budget ?? 0);
  const effectiveMonthlyBudget = data.effectiveMonthlyBudget ?? (baseLivingBudget + carryFromPrevMonth + totalIncome);
  const totalLivingSpent = (data.expenses || [])
      .filter(e => e.checked !== false)
      .reduce((s, e) => s + (e.amount - (e.settleAmount || 0)), 0);
  const totalFixedSpent = (data.fixed || []).reduce((s, f) => s + f.amount, 0);
  const totalEventSpent = (data.events || []).reduce((s, e) => s + e.amount, 0);
  const totalCombinedSpent = totalLivingSpent + totalFixedSpent + totalEventSpent + installmentChargeThisMonth + debtChargeThisMonth;
  const remainingLiving = effectiveMonthlyBudget - totalLivingSpent;
  const livingPct = effectiveMonthlyBudget > 0 ? Math.round((totalLivingSpent / effectiveMonthlyBudget) * 100) : 0;

  const getCycleSpent = (start: string, end: string) =>
      (data.expenses || []).filter(e => e.date >= start && e.date <= end && e.checked !== false)
          .reduce((s, e) => s + (e.amount - (e.settleAmount || 0)), 0);

  // 달력
  const [calYear, calMonth] = activeMonth.split("-").map(Number);
  const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);
  const paydayOfMonth = new Date(calYear, calMonth, 0).getDate();
  const paydayStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(paydayOfMonth).padStart(2, "0")}`;

  const getDayExps = (day: number) => {
    const dateStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return (data.expenses || []).filter(e => e.date === dateStr && e.checked !== false);
  };
  const getDayTotal = (day: number) => getDayExps(day).reduce((s, e) => s + (e.amount - (e.settleAmount || 0)), 0);

  return (
      <div className={styles.container} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* ── 1. 날짜 + D-Day ── */}
        <div className={styles.tabHeader}>
          <div>
            <h2 className={styles.tabTitle}>
              <span style={{ fontSize: "0.65rem", color: "var(--c-text-faint)", fontWeight: 500 }}>TODAY&nbsp;</span>
              {(() => {
                const d = new Date();
                const pad = (n: number) => String(n).padStart(2, "0");
                const todayStr2 = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                const cyc = (data.cycles || []).find(c => c.start <= todayStr2 && todayStr2 <= c.end);
                return (
                    <>
                      <span>{d.getFullYear()}년 {d.getMonth() + 1}월 {d.getDate()}일</span>
                      {cyc && <span style={{ fontSize: "0.6875rem", color: "var(--c-text-muted)", fontWeight: 500 }}>· {getCleanLabel(cyc.label)}</span>}
                    </>
                );
              })()}
            </h2>
            <PaydayCountdown />


            {/* ── 총 지출 한 줄 ── */}
            <p style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-faint)", textAlign: "center", "margin-top": "0.375rem" }}>
              총 지출 <span style={{ fontWeight: 700, color: "var(--c-red)", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(totalCombinedSpent)}</span>
            </p>

          </div>
        </div>


        {/* ── 2. 남은 생활비 예산 ── */}
        <div className={styles.cardLight}>
          <div className={styles.cardHeadRow}>
            <span className={styles.dotBlack} />
            <h3 className={styles.cardTitleBlack}>남은 생활비 예산</h3>
          </div>
          <div className={styles.specBox}>
            <div className={styles.specRow}>
              <span className={styles.specLabel}>내 예산</span>
              <span className={styles.specValue}>{formatCurrency(baseLivingBudget)}</span>
            </div>
            {carryFromPrevMonth > 0 && (
                <div className={styles.specRowCarry}>
                  <span>이월금 (+)</span>
                  <span className={styles.specValueMono}>+{formatCurrency(carryFromPrevMonth)}</span>
                </div>
            )}
            <div className={styles.specRowSubtotal}>
              <span className={styles.specLabelStrong}>사용 예산</span>
              <span className={styles.specValue}>{formatCurrency(effectiveMonthlyBudget)}</span>
            </div>
            <div className={styles.specRow}>
              <span className={styles.specLabel}>지출 (-)</span>
              <span className={styles.specValue}>{formatCurrency(totalLivingSpent)}</span>
            </div>
            <div className={styles.specRowTotal}>
              <span className={styles.specRowTotalLabel}>남은 생활비</span>
              <span className={styles.remainAmount} data-negative={remainingLiving < 0}>
              {formatCurrency(remainingLiving)}
            </span>
            </div>
          </div>
          <div className={styles.progressWrap}>
            <div className={styles.progressLabelRow}>
              <span>소진율</span>
              <span className={styles.specValueMono}>{livingPct}%</span>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} data-level={getLevel(livingPct)} style={{ width: `${Math.min(livingPct, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* ── 3. 주기별 예산 잔액 ── */}
        <div className={styles.cardLight}>
          <div className={styles.cardHeadRow}>
            <span className={styles.dotBlack} />
            <h3 className={styles.cardTitleBlack}>주기별 예산 잔액</h3>
          </div>
          <div className={styles.specBox}>
            {(data.cycles || []).map((c, idx) => {
              const spent = getCycleSpent(c.start, c.end);
              const carryIn = c.carryIn ?? 0;
              const incomeAmount = (c as any).incomeAmount ?? 0;
              const usedBudget = c.budget + carryIn + incomeAmount;
              const bal = usedBudget - spent;
              const pct = usedBudget > 0 ? Math.round((spent / usedBudget) * 100) : 0;
              const isCurrentCycle = todayStr >= c.start && todayStr <= c.end;
              return (
                  <div key={idx} className={styles.cycleItem} data-current={isCurrentCycle}>
                    <div className={styles.cycleTopRow}>
                      <div className={styles.cycleTopLeft}>
                        <span className={styles.cycleLabel}>{getCleanLabel(c.label)}</span>
                        <span className={styles.cycleDate}>({dlabel(c.start)} ~ {dlabel(c.end)})</span>
                        <button onClick={() => onEditCycle(idx)} className={styles.cycleEditBtn}>수정</button>
                      </div>
                      <span className={styles.cycleBalance} data-negative={bal < 0}>
                    {bal < 0 ? "-" : ""}{formatCurrency(Math.abs(bal))}
                  </span>
                    </div>
                    <div className={styles.cycleBarTrack}>
                      <div className={styles.cycleBarFill} data-level={getLevel(pct)} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className={styles.cycleStats}>
                      <span>내 예산 <span className={styles.cycleStatStrong}>{formatCurrency(c.budget)}</span></span>
                      {incomeAmount > 0 && <span>수입 <span className={styles.cycleStatIncome}>+{formatCurrency(incomeAmount)}</span></span>}
                      {carryIn > 0 && <span>잔액 <span className={styles.cycleStatCarry} data-positive={true}>+{formatCurrency(carryIn)}</span></span>}
                      <span>지출 <span className={styles.cycleStatStrong}>-{formatCurrency(spent)}</span></span>
                    </div>
                  </div>
              );
            })}
          </div>
        </div>

        {/* ── 4. 달력 ── */}
        <div className={styles.cardLight}>
          <div className={styles.cardHeadRow}>
            <span className={styles.dotBlack} />
            <h3 className={styles.cardTitleBlack}>{calYear}년 {calMonth}월</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginTop: "0.75rem" }}>
            {["일","월","화","수","목","금","토"].map(d => (
                <div key={d} style={{ textAlign: "center", fontSize: "0.65rem", color: "var(--c-text-faint)", fontWeight: 500, padding: "0.3rem 0" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayExps = getDayExps(day);
              const total = getDayTotal(day);
              const isToday = dateStr === todayStr;
              const isSelected = selectedDate === dateStr;
              const isPayday = dateStr === paydayStr;
              return (
                  <div key={day}
                       onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                       style={{
                         height: "64px", padding: "5px 4px", cursor: "pointer",
                         background: isSelected ? "var(--c-income-bg)" : "transparent",
                         borderBottom: "1px solid var(--c-bg-muted)",
                         display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden",
                       }}
                  >
                    <div style={{ fontSize: "0.75rem", fontWeight: isToday ? 700 : 400, color: isToday || isSelected ? "var(--c-green)" : "var(--c-deepgreen)", lineHeight: 1 }}>
                      {day}
                    </div>
                    {isPayday && <div style={{ fontSize: "0.5rem", color: "var(--c-green)", fontWeight: 600, lineHeight: 1 }}>💰</div>}
                    {total > 0 && <div style={{ fontSize: "0.6rem", color: "var(--c-red)", fontWeight: 700, lineHeight: 1 }}>-{fmtShort(total)}</div>}
                    {dayExps.length > 0 && <div style={{ fontSize: "0.55rem", color: "var(--c-text-faint)", lineHeight: 1 }}>{dayExps.length}건</div>}
                    {dayMemos[dateStr] && <div style={{ fontSize: "0.5rem", color: "var(--c-purple)", lineHeight: 1 }}>📝</div>}
                  </div>
              );
            })}
          </div>
          {selectedDate && (
              <div style={{ marginTop: "0.75rem", borderTop: "var(--hairline)", paddingTop: "0.75rem" }}>
                <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--c-deepgreen)", marginBottom: "0.5rem" }}>
                  {selectedDate.slice(5).replace("-", "/")}
                </div>
                <input
                    key={selectedDate} type="text" placeholder="날짜 메모..."
                    defaultValue={dayMemos[selectedDate] || ""}
                    onBlur={e => onUpdateDayMemo?.(selectedDate, e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { onUpdateDayMemo?.(selectedDate, e.currentTarget.value); e.currentTarget.blur(); } }}
                    style={{ width: "100%", fontSize: "var(--fs-xs)", padding: "0.4rem 0.6rem", borderRadius: "6px", border: "var(--border-base)", background: "var(--c-bg-soft)", color: "var(--c-deepgreen)", outline: "none", boxSizing: "border-box", marginBottom: "0.5rem" }}
                />
                {getDayExps(parseInt(selectedDate.slice(8))).length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      {getDayExps(parseInt(selectedDate.slice(8))).map((e, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-xs)", color: "var(--c-deepgreen)" }}>
                            <span>{e.name}{e.memo && <span style={{ color: "var(--c-text-faint)", marginLeft: "0.3rem" }}>{e.memo}</span>}</span>
                            <span style={{ color: "var(--c-red)", fontWeight: 600 }}>-{formatCurrency(e.amount - (e.settleAmount || 0))}</span>
                          </div>
                      ))}
                    </div>
                )}
              </div>
          )}
        </div>

        {/* 메모 카드 */}
        {data.memo && data.memo.trim() && (
            <div className={styles.memoCard}>
              <div className={styles.memoHeader}>
                <h3 className={styles.memoTitle}>
                  <BookOpen className={styles.memoIcon} /> 이번 달 주요 메모
                </h3>
                <button onClick={onOpenMemo} className={styles.memoEditBtn}>상세 편집 →</button>
              </div>
              <div className={styles.memoBody}>{data.memo}</div>
            </div>
        )}

      </div>
  );
};