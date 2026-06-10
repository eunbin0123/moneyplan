import React, { useState, useEffect } from "react";
import { MonthData, InstallmentItem, DebtItem } from "../types";
import { BookOpen, X, Save } from "lucide-react";
import styles from "../css/OverviewTab.module.css";

/* 월급날 카운트다운 — 말일(토/일이면 그 전 금요일)까지 남은 일/시간/분.
   독립 컴포넌트라 1초 갱신해도 OverviewTab 전체는 리렌더 안 됨. */
function PaydayCountdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const PAY_HOUR = 0; // 월급 입금 시각(시). 새벽 6시쯤 들어오면 6으로 바꾸면 됨.

  const paydayOf = (y: number, m: number) => {
    const last = new Date(y, m + 1, 0); // 해당 월 말일
    const d = new Date(last);
    const dow = last.getDay(); // 0=일 … 6=토
    if (dow === 6) d.setDate(d.getDate() - 1); // 토 → 금
    else if (dow === 0) d.setDate(d.getDate() - 2); // 일 → 금
    d.setHours(PAY_HOUR, 0, 0, 0);
    return d;
  };

  const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

  const thisPay = paydayOf(now.getFullYear(), now.getMonth());

  if (sameDay(now, thisPay)) {
    return (
        <div className={styles.paydayToday}>
          오늘 월급날 🎉
        </div>
    );
  }

  let target = thisPay;
  if (now.getTime() >= thisPay.getTime()) {
    const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    target = paydayOf(nm.getFullYear(), nm.getMonth());
  }

  const totalMin = Math.floor((target.getTime() - now.getTime()) / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;

  return (
      <div className={styles.paydayCountdown}>
        <span style={{ fontSize: "0.6875rem", color: "var(--c-text-faint)", fontWeight: 500 }}>월급까지</span>
        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--c-green)", fontVariantNumeric: "tabular-nums" }}>
        {days}일 {hours}시간 {mins}분
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
  onUpdateAllocations: (budget: number, fixedBudget: number, eventBudget: number, totalBudget?: number) => void;
  installments?: InstallmentItem[];
  debts?: DebtItem[];
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
                                                          data,
                                                          activeMonth,
                                                          onEditCycle,
                                                          onOpenMemo,
                                                          onOpenSavings,
                                                          onUpdateAllocations,
                                                          installments = [],
                                                          debts = [],
                                                        }) => {
  // Modal toggle state
  const [isEditAllocModalOpen, setIsEditAllocModalOpen] = useState(false);

  // Modal form states
  const [inputTotalBudget, setInputTotalBudget] = useState("");
  const [inputBudget, setInputBudget] = useState("");
  const [inputFixedBudget, setInputFixedBudget] = useState("");
  const [inputEventBudget, setInputEventBudget] = useState("");

  useEffect(() => {
    if (isEditAllocModalOpen) {
      setInputTotalBudget(String(data.totalBudget ?? ""));
      setInputBudget(String(data.budget));
      setInputFixedBudget(String(data.fixedBudget ?? 160000));
      setInputEventBudget(String(data.eventBudget ?? 200000));
    }
  }, [isEditAllocModalOpen, data]);

  // 1. 생활비 (Living Expenses) Calculations
  const baseLivingBudget = data.budget;
  const carryFromPrevMonth = data.carryFromPrevMonth ?? 0;
  const effectiveMonthlyBudget = data.effectiveMonthlyBudget ?? baseLivingBudget;

  const totalLivingSpent = data.expenses
      .filter((e) => e.checked !== false)
      .reduce((sum, item) => sum + (item.amount - (item.settleAmount || 0)), 0);
  const remainingLiving = effectiveMonthlyBudget - totalLivingSpent;
  const livingPct = effectiveMonthlyBudget > 0 ? Math.round((totalLivingSpent / effectiveMonthlyBudget) * 100) : 0;

  // 2. 고정지출 (Fixed Expenses) Calculations
  const fixedAllocBudget = data.fixedBudget ?? 160000;
  const totalFixedSpent = data.fixed.reduce((sum, item) => sum + item.amount, 0);
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

  // 6. 통합 집계 (Combined / Aggregate)
  const totalCombinedBudget = effectiveMonthlyBudget + fixedAllocBudget + eventAllocBudget;
  const totalCombinedSpent = totalLivingSpent + totalFixedSpent + totalEventSpent + installmentChargeThisMonth + debtChargeThisMonth;
  const totalCombinedRemaining = totalCombinedBudget - totalCombinedSpent;
  const combinedPct = totalCombinedBudget > 0 ? Math.round((totalCombinedSpent / totalCombinedBudget) * 100) : 0;

  const getCycleSpent = (start: string, end: string) => {
    return data.expenses
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

  const handleSaveAllocations = (e: React.FormEvent) => {
    e.preventDefault();
    const tb = inputTotalBudget ? parseInt(inputTotalBudget, 10) : NaN;
    const fx = parseInt(inputFixedBudget, 10);
    const ev = parseInt(inputEventBudget, 10);
    if (isNaN(fx) || fx < 0 || isNaN(ev) || ev < 0) return;

    if (!isNaN(tb) && tb > 0) {
      onUpdateAllocations(0, fx, ev, tb);
    } else {
      const bg = parseInt(inputBudget, 10);
      if (isNaN(bg) || bg < 0) return;
      onUpdateAllocations(bg, fx, ev, undefined);
    }
    setIsEditAllocModalOpen(false);
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
                const cyc = data.cycles.find((c) => c.start <= todayStr && todayStr <= c.end);
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
          <button onClick={() => setIsEditAllocModalOpen(true)} className={styles.btnBudget}>
            예산 조정
          </button>
          <button onClick={onOpenSavings} className={styles.btnSavings}>
            분배
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
                  <span className={styles.specLabel}>일반 생활비 지출</span>
                  <span className={styles.specValueDark}>{formatCurrency(totalLivingSpent)}</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>월 정기 고정비 지출</span>
                  <span className={styles.specValueDark}>{formatCurrency(totalFixedSpent)}</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>비정기 경조사비 지출</span>
                  <span className={styles.specValueDark}>{formatCurrency(totalEventSpent)}</span>
                </div>
                <div className={styles.specRow}>
                  <span className={styles.specLabel}>이번 달 할부금</span>
                  <span className={styles.specValueDark}>{formatCurrency(installmentChargeThisMonth)}</span>
                </div>
                {debtChargeThisMonth > 0 && (
                    <div className={styles.specRow}>
                      <span className={styles.specLabel}>당겨쓰기 차감</span>
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
                {data.cycles.map((c, idx) => {
                  const spent = getCycleSpent(c.start, c.end);
                  const bal = c.budget - spent;
                  const pct = c.budget > 0 ? Math.round((spent / c.budget) * 100) : 0;
                  const carryIn = c.carryIn ?? 0;
                  const baseBudget = c.baseBudget ?? c.budget;

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
                          <span>내 예산 <span className={styles.cycleStatStrong}>{formatCurrency(baseBudget)}</span></span>
                          {(c as any).incomeAmount > 0 && <span>수입 <span className={styles.cycleStatIncome}>+{formatCurrency((c as any).incomeAmount)}</span></span>}
                          <span>이월 <span className={styles.cycleStatCarry} data-positive={carryIn > 0}>+{formatCurrency(carryIn)}</span></span>
                          <span>사용예산 <span className={styles.cycleStatStrong}>{formatCurrency(c.budget)}</span></span>
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

        {/* ✏️ 고도화 디자인 적용된 예산 배정액 조율 모달 */}
        {isEditAllocModalOpen && (
            <div className={styles.overlay}>
              <div className={styles.panel}>
                <div className={styles.modalHeader}>
                  <h3 className={styles.modalTitle}>가구 예산 배정액 조율</h3>
                  <button onClick={() => setIsEditAllocModalOpen(false)} className={styles.closeBtn}>
                    <X className={styles.closeIcon} />
                  </button>
                </div>

                <form onSubmit={handleSaveAllocations} className={styles.form}>
                  {/* ── 총예산 자동 분배 모드 카드화 ── */}
                  <div className={styles.totalBudgetBox}>
                    <p className={styles.totalBudgetTitle}>✦ 총예산 자동 분배 모드</p>
                    <div>
                      <label className={styles.labelLight}>
                        이달 총 지출 한도
                        <span className={styles.labelLightHint}>(비워두면 아래 수동 입력 사용)</span>
                      </label>
                      <input
                          type="number"
                          min="0"
                          placeholder="예) 1200000"
                          value={inputTotalBudget}
                          onChange={(e) => setInputTotalBudget(e.target.value)}
                          className={styles.inputDark}
                      />
                    </div>

                    {/* 자동 역산 미리보기 (영수증 스타일 컴포넌트화) */}
                    {inputTotalBudget && parseInt(inputTotalBudget, 10) > 0 && (() => {
                      const tb = parseInt(inputTotalBudget, 10);
                      const fx = parseInt(inputFixedBudget, 10) || 0;
                      const ev = parseInt(inputEventBudget, 10) || 0;
                      const instCharge = installmentChargeThisMonth;
                      const debtCharge = debtChargeThisMonth;
                      const living = Math.max(0, tb - fx - ev - instCharge - debtCharge);
                      const cycleCount = data.cycles.length || 3;
                      const base = Math.floor(living / cycleCount);
                      const remainder = living - base * cycleCount;
                      return (
                          <div className={styles.previewCalc}>
                            <div className={styles.previewRow}>
                              <span>총 한도</span>
                              <span className={styles.previewValueStrong}>{tb.toLocaleString("ko-KR")}원</span>
                            </div>
                            <div className={styles.previewRow}>
                              <span>― 고정비</span>
                              <span>-{fx.toLocaleString("ko-KR")}원</span>
                            </div>
                            <div className={styles.previewRow}>
                              <span>― 경조사비</span>
                              <span>-{ev.toLocaleString("ko-KR")}원</span>
                            </div>
                            {instCharge > 0 && (
                                <div className={styles.previewRow}>
                                  <span>― 할부금</span>
                                  <span>-{instCharge.toLocaleString("ko-KR")}원</span>
                                </div>
                            )}
                            {debtCharge > 0 && (
                                <div className={styles.previewRow}>
                                  <span>― 당겨쓰기</span>
                                  <span>-{debtCharge.toLocaleString("ko-KR")}원</span>
                                </div>
                            )}
                            <div className={styles.previewRowDivider}>
                              <span>생활비 예산</span>
                              <span>{living.toLocaleString("ko-KR")}원</span>
                            </div>
                            <div className={styles.previewRowResult}>
                              <span>→ 주기당 ({cycleCount}등분)</span>
                              <span>
                          {base.toLocaleString("ko-KR")}원{" "}
                                {remainder > 0 ? `/ 마지막 +${remainder.toLocaleString("ko-KR")}` : ""}
                        </span>
                            </div>
                          </div>
                      );
                    })()}
                  </div>

                  <p className={styles.divider}>또는 수동으로 직접 입력</p>

                  <div>
                    <label className={styles.labelBetween}>
                      <span>생활비 예산 (수동)</span>
                      <span className={styles.labelHint}>총예산 입력 시 자동 계산됨</span>
                    </label>
                    <input
                        type="text"
                        readOnly={!!(inputTotalBudget && parseInt(inputTotalBudget, 10) > 0)}
                        disabled={!!(inputTotalBudget && parseInt(inputTotalBudget, 10) > 0)}
                        value={
                          inputTotalBudget && parseInt(inputTotalBudget, 10) > 0
                              ? (() => {
                                const tb = parseInt(inputTotalBudget, 10);
                                const fx = parseInt(inputFixedBudget, 10) || 0;
                                const ev = parseInt(inputEventBudget, 10) || 0;
                                const living = Math.max(0, tb - fx - ev - installmentChargeThisMonth - debtChargeThisMonth);
                                return living.toLocaleString("ko-KR") + "원 (자동계산)";
                              })()
                              : formatCurrency(Number(inputBudget))
                        }
                        className={styles.inputReadonly}
                    />
                  </div>

                  <div>
                    <label className={styles.label}>고정지출 예산</label>
                    <input
                        type="number"
                        required
                        min="0"
                        value={inputFixedBudget}
                        onChange={(e) => setInputFixedBudget(e.target.value)}
                        className={styles.inputMono}
                    />
                  </div>

                  <div>
                    <label className={styles.label}>경조사비 예산</label>
                    <input
                        type="number"
                        required
                        min="0"
                        value={inputEventBudget}
                        onChange={(e) => setInputEventBudget(e.target.value)}
                        className={styles.inputMono}
                    />
                  </div>

                  <div className={styles.actions}>
                    <button type="button" onClick={() => setIsEditAllocModalOpen(false)} className={styles.btnCancel}>
                      취소
                    </button>
                    <button type="submit" className={styles.btnSave}>
                      <Save className={styles.btnIcon} /> 저장
                    </button>
                  </div>
                </form>
              </div>
            </div>
        )}
      </div>
  );
};