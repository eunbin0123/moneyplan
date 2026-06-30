import React, { useMemo } from "react";
import { BudgetState } from "../types";
import { calcInstallmentForMonth } from "../utils/budgetCalculator";
// @ts-ignore
import styles from "../css/DashboardTab.module.css";

interface DashboardTabProps {
  budgetState: BudgetState;
  months: string[];
}

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
const fmtM = (key: string) => {
  const [y, m] = key.split("-");
  return `${m}월`;
};

export const DashboardTab: React.FC<DashboardTabProps> = ({ budgetState, months }) => {
  const data = useMemo(() => {
    // 전체 할부 목록
    const allInstallments = Object.values(budgetState).flatMap(md => md.installments || []);

    return months.map(m => {
      const md = budgetState[m];
      if (!md) return null;

      // 저축액: 생활비/고정지출/경조사비/예비비 제외, 순수 저축 항목만
      const excludeNames = ["생활비", "고정지출", "경조사비", "예비비"];
      const savingsAccounts = (md.accounts || []).filter(a => !excludeNames.includes(a.name));
      const savings = savingsAccounts.reduce((s, a) => s + a.amount, 0);

      // 지출: 생활비 + 고정비 + 경조사비 + 할부 + 당겨쓰기
      const living = (md.expenses || [])
          .filter(e => e.checked !== false)
          .reduce((s, e) => s + (e.amount - (e.settleAmount || 0)), 0);
      const fixed = (md.fixed || []).reduce((s, f) => s + f.amount, 0);
      const events = (md.events || []).reduce((s, e) => s + e.amount, 0);
      const installment = calcInstallmentForMonth(m, allInstallments);
      const debt = (md.debts || []).reduce((s, d) => s + d.amount, 0);
      const totalSpend = living + fixed + events + installment + debt;

      const salary = md.salary ?? 0;
      const savingsRate = salary > 0 ? Math.round((savings / salary) * 100) : 0;

      return { month: m, savings, totalSpend, salary, savingsRate };
    }).filter(Boolean) as { month: string; savings: number; totalSpend: number; salary: number; savingsRate: number }[];
  }, [budgetState, months]);

  if (data.length === 0) return (
      <div className={styles.empty}>데이터가 없습니다.</div>
  );

  const avgSavings = Math.round(data.reduce((s, d) => s + d.savings, 0) / data.length);
  const avgRate = Math.round(data.reduce((s, d) => s + d.savingsRate, 0) / data.length);

  const maxVal = Math.max(...data.map(d => Math.max(d.savings, d.totalSpend)), 1);
  const chartH = 180;
  const chartW = 320;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const xStep = data.length > 1 ? innerW / (data.length - 1) : 0;
  const yScale = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const savingsPath = data.map((d, i) =>
      `${i === 0 ? "M" : "L"}${padL + i * xStep},${yScale(d.savings)}`
  ).join(" ");

  const spendPath = data.map((d, i) =>
      `${i === 0 ? "M" : "L"}${padL + i * xStep},${yScale(d.totalSpend)}`
  ).join(" ");

  // y축 눈금 (3개)
  const yTicks = [0, 0.5, 1].map(r => ({
    val: Math.round(maxVal * r),
    y: yScale(maxVal * r),
  }));

  return (
      <div className={styles.root}>
        <div className={styles.header}>
          <h2 className={styles.title}>월별 현황</h2>
        </div>

        {/* 요약 카드 */}
        <div className={styles.summaryRow}>
          <div className={styles.summaryCard}>
            <p className={styles.summaryLabel}>평균 저축</p>
            <p className={styles.summaryValue}>{fmt(avgSavings)}원</p>
          </div>
          <div className={styles.summaryCard}>
            <p className={styles.summaryLabel}>평균 저축률</p>
            <p className={styles.summaryValueGreen}>{avgRate}%</p>
          </div>
        </div>

        {/* 라인 차트 */}
        <div className={styles.chartCard}>
          <div className={styles.legend}>
            <span className={styles.legendSavings}>● 저축</span>
            <span className={styles.legendSpend}>● 지출</span>
          </div>
          <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} className={styles.chart}>
            {/* 그리드 */}
            {yTicks.map((t, i) => (
                <g key={i}>
                  <line x1={padL} y1={t.y} x2={chartW - padR} y2={t.y} className={styles.gridLine} />
                  <text x={padL - 6} y={t.y + 4} className={styles.axisLabel} textAnchor="end">
                    {t.val >= 10000 ? `${Math.round(t.val / 10000)}만` : `${t.val}`}
                  </text>
                </g>
            ))}

            {/* x축 레이블 */}
            {data.map((d, i) => (
                <text
                    key={i}
                    x={padL + i * xStep}
                    y={chartH - 6}
                    className={styles.axisLabel}
                    textAnchor="middle"
                >
                  {fmtM(d.month)}
                </text>
            ))}

            {/* 지출 라인 */}
            <path d={spendPath} className={styles.lineSpend} />
            {data.map((d, i) => (
                <circle key={i} cx={padL + i * xStep} cy={yScale(d.totalSpend)} r={3} className={styles.dotSpend} />
            ))}

            {/* 저축 라인 */}
            <path d={savingsPath} className={styles.lineSavings} />
            {data.map((d, i) => (
                <circle key={i} cx={padL + i * xStep} cy={yScale(d.savings)} r={3} className={styles.dotSavings} />
            ))}
          </svg>
        </div>

        {/* 월별 테이블 */}
        <div className={styles.tableCard}>
          {data.map(d => (
              <div key={d.month} className={styles.row}>
                <span className={styles.rowMonth}>{fmtM(d.month)}</span>
                <div className={styles.rowRight}>
                  <div className={styles.rowItem}>
                    <span className={styles.rowLabel}>저축</span>
                    <span className={styles.rowSavings}>{fmt(d.savings)}원</span>
                  </div>
                  <div className={styles.rowItem}>
                    <span className={styles.rowLabel}>지출</span>
                    <span className={styles.rowSpend}>{fmt(d.totalSpend)}원</span>
                  </div>
                  <div className={styles.rowItem}>
                    <span className={styles.rowLabel}>저축률</span>
                    <span className={styles.rowRate}>{d.savingsRate}%</span>
                  </div>
                </div>
              </div>
          ))}
        </div>
      </div>
  );
};