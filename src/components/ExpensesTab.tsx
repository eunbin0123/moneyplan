import React, { useState } from "react";
import { MonthData, ExpenseItem } from "../types";
import { Plus, ChevronDown, Archive, Check, TrendingUp, Edit2 } from "lucide-react";
import styles from "../css/ExpensesTab.module.css";

interface ExpensesTabProps {
    data: MonthData;
    onAddExpense: () => void;
    onEditExpense: (idx: number) => void;
    onDeleteExpense: (idx: number) => void;
    onCycleStatus: (idx: number) => void;
    onReorderExpense: (fromIdx: number, toIdx: number) => void;
    onAddIncome: () => void;
    onEditIncome: (id: string) => void;
    onDeleteIncome: (id: string) => void;
    isMonthNavOpen: boolean;
    
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
                                                            data,
                                                            onAddExpense,
                                                            onEditExpense,
                                                            onDeleteExpense,
                                                            onCycleStatus,
                                                            onReorderExpense,
                                                            onAddIncome,
                                                            onEditIncome,
                                                            onDeleteIncome,
                                                            isMonthNavOpen,
                                                        }) => {
    const getInitialCollapsed = () => {
        const today = new Date().toISOString().split("T")[0];
        const result: Record<number, boolean> = {};
        data.cycles.forEach((c, i) => {
            result[i] = !(today >= c.start && today <= c.end);
        });
        return result;
    };

    const [collapsed, setCollapsed] = useState<Record<number, boolean>>(getInitialCollapsed);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    const toggleCollapse = (idx: number) => {
        setCollapsed((prev) => ({ ...prev, [idx]: !prev[idx] }));
    };

    const getCycleExpenses = (start: string, end: string) => {
        return data.expenses
            .map((e, idx) => ({ ...e, _idx: idx }))
            .filter((e) => e.date >= start && e.date <= end)
            .sort((a, b) => {
                const d = a.date.localeCompare(b.date);
                return d !== 0 ? d : a._idx - b._idx;
            });
    };

    const getCycleSpent = (start: string, end: string) => {
        return data.expenses
            .filter((e) => e.date >= start && e.date <= end && e.checked !== false)
            .reduce((sum, item) => sum + (item.amount - (item.settleAmount || 0)), 0);
    };

    const getUnclassifiedExpenses = () => {
        return data.expenses
            .map((e, idx) => ({ ...e, _idx: idx }))
            .filter((e) => !data.cycles.some((c) => e.date >= c.start && e.date <= c.end));
    };

    const dlabel = (dateStr: string) => {
        try {
            const parts = dateStr.split("-");
            if (parts.length >= 3) return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
            return dateStr;
        } catch { return dateStr; }
    };

    const getCleanLabel = (label: string) => label.replace(/\s*\(.*?\)\s*/g, "").trim();
    const formatCurrency = (amount: number) => Math.round(amount).toLocaleString("ko-KR") + "원";

    // 미결제(결제대기) 집계: 예산반영(checked)된 항목 중 아직 결제 안 한 것 = 통장에 확보해둬야 할 돈
    const unpaidItems = data.expenses.filter((e) => e.checked !== false && e.paid !== true);
    const unpaidTotal = unpaidItems.reduce((sum, e) => sum + e.amount, 0);  // 카드 전액 = 통장에 채워야 할 돈
    const unpaidCount = unpaidItems.length;
    const unpaidHasSplit = unpaidItems.some((e) => (e.settleAmount || 0) > 0);

    const renderExpenseItem = (e: any) => {
        const originalIdx = e._idx ?? data.expenses.findIndex((item) => item === e);
        const reflected = e.checked !== false;   // 예산 반영 여부
        const paid = e.paid === true;            // 결제완료 여부
        const settle = e.settleAmount || 0;      // 정산받을(친구 몫)
        const net = e.amount - settle;           // 내 몫
        const isSplit = settle > 0;
        const checkState = !reflected ? "unreflected" : !paid ? "unpaid" : "paid";
        return (
            <div
                key={originalIdx}
                draggable
                onDragStart={(ev) => {
                    ev.dataTransfer.effectAllowed = "move";
                    ev.dataTransfer.setData("text/plain", String(originalIdx));
                }}
                onDragOver={(ev) => { ev.preventDefault(); setDragOverIdx(originalIdx); }}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={(ev) => {
                    ev.preventDefault();
                    const from = parseInt(ev.dataTransfer.getData("text/plain"), 10);
                    if (from !== originalIdx) onReorderExpense(from, originalIdx);
                    setDragOverIdx(null);
                }}
                onDragEnd={() => setDragOverIdx(null)}
                className={styles.expenseItem}
                data-dragover={dragOverIdx === originalIdx}
            >
                <div className={styles.expenseLeft}>
                    <button
                        onClick={(evt) => { evt.stopPropagation(); onCycleStatus(originalIdx); }}
                        title={!reflected ? "미반영 (눌러서 예산반영)" : !paid ? "예산반영·결제대기 (눌러서 결제완료)" : "결제완료 (눌러서 미반영)"}
                        className={styles.checkbox}
                        data-state={checkState}
                    >
                        {paid && <Check className={styles.checkboxCheck} />}
                    </button>
                    <div className={styles.expenseTextWrap}>
                        <p className={styles.expenseName} data-reflected={reflected}>
                            {e.name}
                        </p>
                        {isSplit && (
                            <p className={styles.expenseSplit}>
                                💳 카드 {formatCurrency(e.amount)} · 정산 -{formatCurrency(settle)}
                            </p>
                        )}
                    </div>
                </div>
                <div className={styles.expenseRight}>
                    <span className={styles.expenseAmount} data-reflected={reflected}>
                        -{formatCurrency(net)}
                    </span>
                    <div className={styles.expenseActions}>
                        <button onClick={() => onEditExpense(originalIdx)} className={styles.editBtn}>수정</button>
                        <button onClick={() => onDeleteExpense(originalIdx)} className={styles.deleteBtn}>삭제</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderGroupedExpenses = (exps: any[]) => {
        const groups: Record<string, any[]> = {};
        exps.forEach((e) => {
            if (!groups[e.date]) groups[e.date] = [];
            groups[e.date].push(e);
        });
        const sortedDates = Object.keys(groups).sort((a, b) => a.localeCompare(b));

        return sortedDates.map((date) => {
            const dayExps = groups[date];
            const dayTotal = dayExps.filter((e) => e.checked !== false).reduce((sum, e) => sum + (e.amount - (e.settleAmount || 0)), 0);
            const [, m, d] = date.split("-");
            return (
                <div key={date}>
                    <div className={styles.dateGroupHeader}>
                        <span className={styles.dateGroupLabel}>{parseInt(m, 10)}/{parseInt(d, 10)}</span>
                        <span className={styles.dateGroupTotal}>-{formatCurrency(dayTotal)}</span>
                    </div>
                    {dayExps.map(renderExpenseItem)}
                </div>
            );
        });
    };

    return (
        <div className={styles.container} style={{ "--cycle-header-top": isMonthNavOpen ? "132px" : "76px" } as React.CSSProperties}>
            <div className={styles.header}>
                <h2 className={styles.headerTitle}>지출 내역 기록</h2>
                <div className={styles.headerRight}>
                    {unpaidCount > 0 ? (
                        <span className={styles.unpaidText}>
                            미결제 {unpaidCount}건 · {formatCurrency(unpaidTotal)}
                            {unpaidHasSplit && <span className={styles.unpaidNote}> (정산분 포함)</span>}
                        </span>
                    ) : (
                        <span className={styles.paidText}>✓ 결제 완료</span>
                    )}
                    <div className={styles.headerActions}>
                        <button onClick={onAddIncome} className={`${styles.btnIncome} geo-shadow-sm`}>
                            <TrendingUp className={styles.btnIcon} /> 수입
                        </button>
                        <button onClick={onAddExpense} className={`${styles.btnExpense} geo-shadow-sm`}>
                            <Plus className={styles.btnIcon} /> 지출
                        </button>
                    </div>
                </div>
            </div>

            <div className={styles.cycleList}>
                {data.cycles.map((c, ci) => {
                    const cycleExps = getCycleExpenses(c.start, c.end);
                    const spent = getCycleSpent(c.start, c.end);
                    const bal = c.budget - spent;
                    const isOpen = !collapsed[ci];
                    const baseBudget = c.baseBudget ?? c.budget;
                    const carryIn = c.carryIn ?? 0;

                    return (
                        <div key={ci} className={`${styles.cycleCard} geo-shadow`}>
                            <div onClick={() => toggleCollapse(ci)} className={styles.cycleHeader}>
                                <div className={styles.cycleHeaderLeft}>
                                    <ChevronDown className={styles.chevron} data-open={isOpen} />
                                    <div className={styles.cycleHeaderInfo}>
                                        <div className={styles.cycleLabelRow}>
                                            <span className={styles.cycleLabel}>{getCleanLabel(c.label)}</span>
                                            <span className={styles.cycleDateRange}>
                                                ({dlabel(c.start)} ~ {dlabel(c.end)})
                                            </span>
                                        </div>
                                        <div className={styles.cycleStatsRow}>
                                            <span className={styles.cycleStat}>내 예산 <span className={styles.cycleStatValue}>{formatCurrency(baseBudget)}</span></span>
                                            {(c as any).incomeAmount > 0 && <span className={styles.cycleStatIncome}>수입 <span className={styles.cycleStatIncomeValue}>+{formatCurrency((c as any).incomeAmount)}</span></span>}
                                            <span className={styles.cycleStat}>이월 <span className={styles.carryInValue} data-positive={carryIn > 0}>+{formatCurrency(carryIn)}</span></span>
                                            <span className={styles.cycleStat}>사용예산 <span className={styles.cycleStatValue}>{formatCurrency(c.budget)}</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.cycleBalance} data-negative={bal < 0}>
                                    {bal < 0 ? "-" : ""}{formatCurrency(Math.abs(bal))}
                                </div>
                            </div>

                            {isOpen && (
                                <div>
                                    {/* 수입 내역 */}
                                    {(data.incomes || []).filter((inc) => inc.cycleIdx === ci).map((inc) => (
                                        <div key={inc.id} className={styles.incomeRow}>
                                            <div className={styles.incomeLeft}>
                                                <TrendingUp className={styles.incomeIcon} />
                                                <span className={styles.incomeName}>{inc.name}</span>
                                            </div>
                                            <div className={styles.incomeRight}>
                                                <span className={styles.incomeAmount}>+{formatCurrency(inc.amount)}</span>
                                                <button onClick={() => onEditIncome(inc.id)} className={styles.incomeEditBtn}><Edit2 className={styles.incomeEditIcon} /></button>
                                                <button onClick={() => onDeleteIncome(inc.id)} className={styles.incomeDeleteBtn}>✕</button>
                                            </div>
                                        </div>
                                    ))}
                                    {cycleExps.length === 0 ? (
                                        <div className={styles.emptyState}>
                                            <Archive className={styles.emptyIcon} />
                                            지출 내역이 없습니다.
                                        </div>
                                    ) : (
                                        renderGroupedExpenses(cycleExps)
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {getUnclassifiedExpenses().length > 0 && (() => {
                    const unclassifiedExps = getUnclassifiedExpenses();
                    const spent = unclassifiedExps.filter((e) => e.checked !== false).reduce((sum, item) => sum + (item.amount - (item.settleAmount || 0)), 0);
                    const isOpen = !collapsed[-1];

                    return (
                        <div className={`${styles.unclassifiedCard} geo-shadow`}>
                            <div onClick={() => toggleCollapse(-1)} className={styles.unclassifiedHeader}>
                                <div className={styles.cycleHeaderLeft}>
                                    <ChevronDown className={styles.chevron} data-open={isOpen} />
                                    <div className={styles.cycleHeaderInfo}>
                                        <span className={styles.unclassifiedLabel}>미분류 지출</span>
                                        <p className={styles.unclassifiedSub}>
                                            {unclassifiedExps.length}개 항목 | 지출 {formatCurrency(spent)}
                                        </p>
                                    </div>
                                </div>
                                <div className={styles.unclassifiedBalance}>-{formatCurrency(spent)}</div>
                            </div>

                            {isOpen && (
                                <div>{renderGroupedExpenses(unclassifiedExps)}</div>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};