import React, { useState, useEffect } from "react";
import { MonthData, InstallmentItem, DebtItem } from "../types";
import { BookOpen, X, Save } from "lucide-react";
import styles from "../css/OverviewTab.module.css";
import { getPayday, isSameDay } from "../utils/payday";

/* 월급날 카운트다운 — 말일(토/일이면 그 전 금요일)까지 남은 일/시간/분.
   독립 컴포넌트라 1초 갱신해도 OverviewTab 전체는 리렌더 안 됨. */
function PaydayCountdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const thisPay = getPayday(now.getFullYear(), now.getMonth());

  if (isSameDay(now, thisPay)) {
    return (
        <div className={styles.paydayToday}>
          오늘 월급날 🎉
        </div>
    );
  }

  let target = thisPay;
  if (now.getTime() >= thisPay.getTime()) {
    const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    target = getPayday(nm.getFullYear(), nm.getMonth());
  }

  const diffMs = target.getTime() - now.getTime();
  const dDay = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

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
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
                                                          data,
                                                          activeMonth,
                                                          onEditCycle,
                                                          onOpenMemo,
                                                          onOpenSavings,
                                                          onOpenDashboard,
                                                          installments = [],
                                                          debts = [],
                                                          rawCycles = [],
                                                        }) => {
  // Modal toggle state

  // 1. 생활비 (Living Expenses) Calculations
  const salary = data.salary ?? 0;
  const carryFromPrevMonth = data.carryFromPrevMonth ?? 0;

  const totalLivingSpent = (data.expenses || [])
      .filter((e) => e.checked !== false)
      .reduce((sum, item) => sum + (item.amount - (item.settleAmount || 0)), 0);

  // 2. 고정지출 (Fixed Expenses) Calculations
  const fixedAllocBudget = data.fixedBudget ?? 500000;
  const totalFixedSpent = (data.fixed || []).reduce((sum, item) => sum + item.amount, 0);
  const remainingFixed = fixedAllocBudget - totalFixedSpent;
  const fixedPct = fixedAllocBudget > 0 ? Math.round((totalFixedSpent / fixedAllocBudget) * 100) : 0;

  // 3. 경조사비 (Special Event Expenses) Calculations
  const eventAllocBudget = data.eventBudget ?? 200000;
  const totalEventSpent = (data.events || []).reduce((sum, item) => sum + item.amount, 0);
  const remainingEvent = eventAllocBudget - totalEventSpent;
  const eventPct = eventAllocBudget > 0 ? Math.round((totalEventSpent / eventAllocBudget) * 100) : 0;

  // 4. 할부 (Installments) Charges
  const monthIdx = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return y * 12 + (m - 1);
  };
  const installmentChargeThisMonth = (installments || []).reduce((sum, it) => {
    const start = monthIdx(it.startMonth);
    const cur = monthIdx(activeMonth);
    return sum + (cur >= start && cur < start + it.months ? it.monthlyAmount : 0);
  }, 0);

  // 5. 당겨쓰기 (Debt repayment) Charges
  const debtChargeThisMonth = (debts || []).reduce((sum, d) => sum + d.amount, 0);

  // 생활비 예산 = 월급 - 고정account합산 - 할부 - 당겨쓰기 (분배 모달과 동일 로직)
  const fixedAccountsTotal = (data.accounts || [])
      .slice(0, -1)
      .reduce((sum, a) => sum + a.amount, 0);
  // 순수 생활비 (이월 제외) - 주기 분배 기준
  const baseLivingBudget = salary > 0
      ? Math.max(0, salary - fixedAccountsTotal - installmentChargeThisMonth - debtChargeThisMonth)
      : (data.budget ?? 0);
  // 실질 생활비 (이월 포함) - 남은 생활비 표시 기준
  const totalIncome = (data.incomes || []).reduce((sum, inc) => sum + inc.amount, 0);
  // effectiveMonthlyBudget은 budgetCalculator가 수입/이월 포함해서 이미 계산함
  const effectiveMonthlyBudget = data.effectiveMonthlyBudget ?? (baseLivingBudget + carryFromPrevMonth + totalIncome);
  const remainingLiving = effectiveMonthlyBudget - totalLivingSpent;
  const livingPct = effectiveMonthlyBudget > 0 ? Math.round((totalLivingSpent / effectiveMonthlyBudget) * 100) : 0;

  // 6. 통합 집계 (Combined / Aggregate)
  const totalCombinedBudget = effectiveMonthlyBudget + fixedAllocBudget + eventAllocBudget;
  const totalCombinedSpent = totalLivingSpent + totalFixedSpent + totalEventSpent + installmentChargeThisMonth + debtChargeThisMonth;
  const totalCombinedRemaining = totalCombinedBudget - totalCombinedSpent;
  const combinedPct = totalCombinedBudget > 0 ? Math.round((totalCombinedSpent / totalCombinedBudget) * 100) : 0;

  const getCycleSpent = (start: string, end: string) => {
    return (data.expenses || [])
        .filter((e) => e.date >= start && e.date <= end && e.checked !== false)
        .reduce((sum, item) => sum + (item.amount - (item.settleAmount || 0)), 0);
  };

  const getLevel = (pct: number) => (pct >= 100 ? "over" : pct >= 80 ? "warn" : "normal");

  const getCleanLabel = (label: string) => {
    return label.replace(/\s*\(.*?\)\s*/g, "").trim();
  };

  const dlabel = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length >= 3) {
        return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    return Math.round(amount).toLocaleString("ko-KR") + "원";
  };


  return (
      <div className={styles.container}>
        {/* Tab Header */}
        <div className={styles.tabHeader}>
          <div>
            <h2 className={styles.tabTitle}>
              <span style={{ fontSize: "0.6875rem", letterSpacing: "0.08em", color: "var(--c-text-faint)", fontWeight: 500 }}>TODAY</span>
              {(() => {
                const d = new Date();
                const pad = (n: number) => String(n).padStart(2, "0");
                const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                const cyc = (data.cycles || []).find((c) => c.start <= todayStr && todayStr <= c.end);
                return (
                    <>
                      <span>{`${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`}</span>
                      {cyc && (
                          <span style={{ fontSize: "0.6875rem", color: "var(--c-text-muted)", fontWeight: 500 }}>· {getCleanLabel(cyc.label)}</span>
                      )}
                    </>
                );
              })()}
            </h2>
            <PaydayCountdown />
          </div>
        </div>

        <div className={styles.tabActions}>
          <button onClick={onOpenSavings} className={styles.btnSavings}>
            분배
          </button>
          <button onClick={onOpenDashboard} className={styles.btnSavings} style={{ background: "var(--c-purplegrey)", color: "var(--c-purple)" }}>
            통계
          </button>
        </div>

        {/* 2 Grid Elements */}
        <div className={styles.cardGrid}>
          {/* Card 1: 남은 생활비 예산 */}
          <div className={styles.cardLight}>
            <div>
              <div className={styles.cardHeadRow}>
                <span className={styles.dotBlack} />
                <h3 className={styles.cardTitleBlack}>남은 생활비 예산</h3>
              </div>

              <div className={styles.specBox}>
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>내 예산</span>
                  <span className={styles.specValue}>{formatCurrency(baseLivingBudget)}</span>
                </div>
                <div className={styles.specRowCarry}>
                  <span>이월금 (+)</span>
                  <span className={styles.specValueMono}>+{formatCurrency(carryFromPrevMonth)}</span>
                </div>
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
            </div>

            {/* Progress Bar */}
            <div className={styles.progressWrap}>
              <div className={styles.progressLabelRow}>
                <span>수행 소진율</span>
                <span className={styles.specValueMono}>{livingPct}%</span>
              </div>
              <div className={styles.progressTrack}>
                <div
                    className={styles.progressFill}
                    data-level={getLevel(livingPct)}
                    style={{ width: `${Math.min(livingPct, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: 전체 사용내역 */}
          <div className={styles.cardLight}>
            <div>
              <div className={styles.cardHeadRow}>
                <span className={styles.dotBlack} />
                <h3 className={styles.cardTitleBlack}>전체 사용내역 (총 지출 합산)</h3>
              </div>

              <div className={styles.specBox}>
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>생활비</span>
                  <span className={styles.specValueDark}>{formatCurrency(totalLivingSpent)}</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>고정비</span>
                  <span className={styles.specValueDark}>{formatCurrency(totalFixedSpent)}</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>경조사비</span>
                  <span className={styles.specValueDark}>{formatCurrency(totalEventSpent)}</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>할부금</span>
                  <span className={styles.specValueDark}>{formatCurrency(installmentChargeThisMonth)}</span>
                </div>
                {debtChargeThisMonth > 0 && (
                    <div className={styles.specRow}>
                      <span className={styles.specLabel}>당겨쓰기</span>
                      <span className={styles.specValueDark}>{formatCurrency(debtChargeThisMonth)}</span>
                    </div>
                )}
                <div className={styles.specRowTotalDark}>
                  <span className={styles.specRowTotalDarkLabel}>총 지출액 합계</span>
                  <div style={{ textAlign: "right" }}>
                    <span className={styles.totalSpentAmount}>{formatCurrency(totalCombinedSpent)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cycles Breakdown */}
          <div className={styles.cardLight}>
            <div>
              <div className={styles.cardHeadRow}>
                <span className={styles.dotBlack} />
                <h3 className={styles.cardTitleBlack}>주기별 예산 잔액</h3>
              </div>

              <div className={styles.specBox}>
                {(data.cycles || []).map((c, idx) => {
                  const spent = getCycleSpent(c.start, c.end);
                  const carryIn = c.carryIn ?? 0;
                  const incomeAmount = (c as any).incomeAmount ?? 0;
                  const usedBudget = c.budget + carryIn + incomeAmount; // 실제 사용 가능 예산
                  const bal = usedBudget - spent;                        // 남은 돈
                  const pct = usedBudget > 0 ? Math.round((spent / usedBudget) * 100) : 0;

                  return (
                      <div key={idx} className={styles.cycleItem}>
                        <div className={styles.cycleTopRow}>
                          <div className={styles.cycleTopLeft}>
                            <span className={styles.cycleLabel}>{getCleanLabel(c.label)}</span>
                            <span className={styles.cycleDate}>
                          ({dlabel(c.start)} ~ {dlabel(c.end)})
                        </span>
                            <button onClick={() => onEditCycle(idx)} className={styles.cycleEditBtn} title="주기 수정">
                              수정
                            </button>
                          </div>
                          <span className={styles.cycleBalance} data-negative={bal < 0}>
                        {bal < 0 ? "-" : ""}
                            {formatCurrency(Math.abs(bal))}
                      </span>
                        </div>

                        <div className={styles.cycleBarTrack}>
                          <div
                              className={styles.cycleBarFill}
                              data-level={getLevel(pct)}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                          />
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
          </div>

          {/* Memo Card Preview */}
          {data.memo && data.memo.trim() && (
              <div className={styles.memoCard}>
                <div className={styles.memoHeader}>
                  <h3 className={styles.memoTitle}>
                    <BookOpen className={styles.memoIcon} /> 이번 달 주요 메모
                  </h3>
                  <button onClick={onOpenMemo} className={styles.memoEditBtn}>
                    상세 편집 &rarr;
                  </button>
                </div>
                <div className={styles.memoBody}>{data.memo}</div>
              </div>
          )}
        </div>

      </div>
  );
};