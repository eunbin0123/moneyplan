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
    onUpdateExpenseDate: (idx: number, date: string) => void;
    onAddIncome: () => void;
    onEditIncome: (id: string) => void;
    onDeleteIncome: (id: string) => void;
    isMonthNavOpen: boolean;
    allExpenses?: { date: string; amount: number; checked?: boolean; paid?: boolean; settleAmount?: number }[];
    dayMemos?: Record<string, string>;
    onUpdateDayMemo?: (date: string, memo: string) => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
                                                            data,
                                                            onAddExpense,
                                                            onEditExpense,
                                                            onDeleteExpense,
                                                            onCycleStatus,
                                                            onReorderExpense,
                                                            onUpdateExpenseDate,
                                                            onAddIncome,
                                                            onEditIncome,
                                                            onDeleteIncome,
                                                            isMonthNavOpen,
                                                            allExpenses = [],
                                                            dayMemos = {},
                                                            onUpdateDayMemo,
                                                        }) => {
    const getInitialCollapsed = () => {
        const today = new Date().toISOString().split("T")[0];
        const result: Record<number, boolean> = {};
        (data.cycles || []).forEach((c, i) => {
            result[i] = !(today >= c.start && today <= c.end);
        });
        return result;
    };

    const [collapsed, setCollapsed] = useState<Record<number, boolean>>(getInitialCollapsed);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const [dragOverDate, setDragOverDate] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const toggleCollapse = (idx: number) => {
        setCollapsed((prev) => ({ ...prev, [idx]: !prev[idx] }));
    };

    const getCycleExpenses = (start: string, end: string) => {
        return (data.expenses || [])
            .map((e, idx) => ({ ...e, _idx: idx }))
            .filter((e) => e.date >= start && e.date <= end)
            .sort((a, b) => {
                const d = a.date.localeCompare(b.date);
                return d !== 0 ? d : a._idx - b._idx;
            });
    };

    const getCycleSpent = (start: string, end: string) => {
        return (data.expenses || [])
            .filter((e) => e.date >= start && e.date <= end && e.checked !== false)
            .reduce((sum, item) => sum + (item.amount - (item.settleAmount || 0)), 0);
    };

    const getUnclassifiedExpenses = () => {
        return (data.expenses || [])
            .map((e, idx) => ({ ...e, _idx: idx }))
            .filter((e) => !(data.cycles || []).some((c) => e.date >= c.start && e.date <= c.end));
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
    // 미결제: 전체 달 합산 (이전 달 미결제 포함)
    const unpaidItems = allExpenses.filter((e) => e.checked !== false && e.paid !== true);
    const unpaidTotal = unpaidItems.reduce((sum, e) => sum + e.amount, 0);
    const unpaidCount = unpaidItems.length;
    const unpaidHasSplit = unpaidItems.some((e) => (e.settleAmount || 0) > 0);

    const renderExpenseItem = (e: any) => {
        const originalIdx = e._idx ?? (data.expenses || []).findIndex((item) => item === e);
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
                    <div
                        className={styles.dateGroupHeader}
                        data-dragover={dragOverDate === date}
                        onDragOver={(ev) => { ev.preventDefault(); setDragOverDate(date); }}
                        onDragLeave={() => setDragOverDate(null)}
                        onDrop={(ev) => {
                            ev.preventDefault();
                            const from = parseInt(ev.dataTransfer.getData("text/plain"), 10);
                            const exp = (data.expenses || [])[from];
                            if (exp && exp.date !== date) onUpdateExpenseDate(from, date);
                            setDragOverDate(null);
                        }}
                    >
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
            <div className={styles.header} style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h2 className={styles.headerTitle}>지출 내역 기록</h2>
                    {unpaidCount > 0 ? (
                        <span className={styles.unpaidText}>
                            미결제 {unpaidCount}건 · {formatCurrency(unpaidTotal)}
                            {unpaidHasSplit && <span className={styles.unpaidNote}> (정산분 포함)</span>}
                        </span>
                    ) : (
                        <span className={styles.paidText}>✓ 결제 완료</span>
                    )}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "var(--border-base)" }}>
                        <button
                            onClick={() => setViewMode("list")}
                            style={{ padding: "0.35rem 0.75rem", fontSize: "var(--fs-xs)", fontWeight: 500, border: "none", cursor: "pointer", background: viewMode === "list" ? "var(--c-deepgreen)" : "var(--c-card)", color: viewMode === "list" ? "var(--c-card)" : "var(--c-text-muted)" }}
                        >목록</button>
                        <button
                            onClick={() => setViewMode("calendar")}
                            style={{ padding: "0.35rem 0.75rem", fontSize: "var(--fs-xs)", fontWeight: 500, border: "none", cursor: "pointer", background: viewMode === "calendar" ? "var(--c-deepgreen)" : "var(--c-card)", color: viewMode === "calendar" ? "var(--c-card)" : "var(--c-text-muted)" }}
                        >달력</button>
                    </div>
                    <div className={styles.headerActions}>
                        <button onClick={onAddIncome} className={`${styles.btnIncome}`}>
                            수입
                        </button>
                        <button onClick={onAddExpense} className={`${styles.btnExpense}`}>
                            지출
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === "calendar" && (() => {
                const [calYear, calMonth] = (() => {
                    const parts = (data.cycles?.[0]?.end || new Date().toISOString().slice(0, 7) + "-01").split("-");
                    return [parseInt(parts[0]), parseInt(parts[1])];
                })();
                const firstDay = new Date(calYear, calMonth - 1, 1).getDay();
                const daysInMonth = new Date(calYear, calMonth, 0).getDate();
                const expenses = data.expenses || [];

                const getDayExpenses = (day: number) => {
                    const dateStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    return expenses.filter(e => e.date === dateStr && e.checked !== false);
                };
                const getDayTotal = (day: number) => getDayExpenses(day).reduce((s, e) => s + (e.amount - (e.settleAmount || 0)), 0);

                const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                const blanks = Array.from({ length: firstDay }, (_, i) => i);

                return (
                    <div style={{ padding: "0 1rem 6rem" }}>
                        {/* 요일 헤더 */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--c-bg-muted)", marginBottom: "0" }}>
                            {["일", "월", "화", "수", "목", "금", "토"].map(d => (
                                <div key={d} style={{ textAlign: "center", fontSize: "var(--fs-xs)", color: "var(--c-text-faint)", fontWeight: 500, padding: "0.5rem 0" }}>{d}</div>
                            ))}
                        </div>
                        {/* 날짜 그리드 */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0" }}>
                            {blanks.map(i => <div key={`b${i}`} />)}
                            {days.map(day => {
                                const dateStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                const dayExps = getDayExpenses(day);
                                const total = getDayTotal(day);
                                const isSelected = selectedDate === dateStr;
                                const isToday = new Date().toISOString().slice(0, 10) === dateStr;
                                return (
                                    <div key={day}
                                         onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                                         style={{
                                             height: "72px", padding: "6px 4px", borderRadius: "0", cursor: "pointer",
                                             background: isSelected ? "var(--c-income-bg)" : "transparent",
                                             border: "none",
                                             borderBottom: "1px solid var(--c-bg-muted)",
                                             transition: "background 0.15s",
                                             display: "flex", flexDirection: "column", gap: "3px",
                                             overflow: "hidden",
                                         }}
                                    >
                                        {/* 날짜 숫자 */}
                                        <div style={{
                                            fontSize: "0.8rem", fontWeight: (isToday || isSelected) ? 700 : 500, lineHeight: 1,
                                            color: isSelected ? "var(--c-green)" : isToday ? "var(--c-green)" : "var(--c-deepgreen)",
                                        }}>{day}</div>
                                        {/* 금액 */}
                                        {total > 0 && (
                                            <div style={{ fontSize: "0.65rem", color: "var(--c-red)", fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                                                -{total >= 10000 ? `${(total / 10000).toFixed(1)}만` : `${total.toLocaleString()}`}
                                            </div>
                                        )}
                                        {/* 항목명 1개 + 나머지 */}
                                        {dayExps.length > 0 && (
                                            <div style={{ fontSize: "0.6rem", color: "var(--c-text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1 }}>
                                                {dayExps[0].name}{dayExps.length > 1 ? ` +${dayExps.length - 1}` : ""}
                                            </div>
                                        )}
                                        {/* 메모 */}
                                        {dayMemos[dateStr] && (
                                            <div style={{ fontSize: "0.58rem", color: "var(--c-purple)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1 }}>
                                                📝 {dayMemos[dateStr]}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 선택된 날짜 지출 목록 */}
                        {selectedDate && (() => {
                            const sel = expenses.map((e, i) => ({ ...e, _idx: i })).filter(e => e.date === selectedDate);
                            return (
                                <div style={{ marginTop: "1rem", background: "var(--c-card)", borderRadius: "var(--radius-md)", overflow: "hidden", boxShadow: "var(--shadow-soft)" }}>
                                    <div style={{ padding: "0.75rem 1rem", borderBottom: "var(--hairline)" }}>
                                        <div style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--c-deepgreen)", marginBottom: "0.5rem" }}>
                                            {selectedDate.slice(5).replace("-", "/")}
                                        </div>
                                        <input
                                            key={selectedDate}
                                            type="text"
                                            placeholder="날짜 메모 추가..."
                                            defaultValue={dayMemos[selectedDate] || ""}
                                            onBlur={(e) => onUpdateDayMemo?.(selectedDate, e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter") { onUpdateDayMemo?.(selectedDate, e.currentTarget.value); e.currentTarget.blur(); } }}
                                            style={{ width: "100%", fontSize: "var(--fs-xs)", padding: "0.3rem 0.5rem", borderRadius: "6px", border: "var(--border-base)", background: "var(--c-bg-soft)", color: "var(--c-deepgreen)", outline: "none", boxSizing: "border-box" }}
                                        />
                                    </div>
                                    {sel.map((e, i) => (
                                        <div key={i} style={{ padding: "0.6rem 1rem", borderBottom: "var(--hairline)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: "var(--fs-sm)", color: "var(--c-deepgreen)" }}>{e.name}</div>
                                                {e.memo && <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-faint)" }}>{e.memo}</div>}
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--c-red)" }}>-{formatCurrency(e.amount - (e.settleAmount || 0))}</span>
                                                <button onClick={() => onEditExpense(e._idx)} style={{ fontSize: "var(--fs-xs)", color: "var(--c-text-faint)", background: "none", border: "none", cursor: "pointer" }}>수정</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                );
            })()}

            {viewMode === "list" && <div className={styles.cycleList}>
                {(data.cycles || []).map((c, ci) => {
                    const cycleExps = getCycleExpenses(c.start, c.end);
                    const spent = getCycleSpent(c.start, c.end);
                    const carryIn = c.carryIn ?? 0;
                    const incomeAmount = (c as any).incomeAmount ?? 0;
                    const baseBudget = c.baseBudget ?? c.budget;
                    const effectiveBudget = (c as any).effectiveBudget ?? (baseBudget + carryIn + incomeAmount);
                    const bal = effectiveBudget - spent;
                    const isOpen = !collapsed[ci];

                    return (
                        <div key={ci} className={`${styles.cycleCard} `}>
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
                                            <span className={styles.cycleStat}> <span className={styles.carryInValue} data-positive={carryIn > 0}>+{formatCurrency(carryIn)}</span></span>
                                            <span className={styles.cycleStat}>사용예산 <span className={styles.cycleStatValue}>{formatCurrency(effectiveBudget)}</span></span>
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
                        <div className={`${styles.unclassifiedCard} `}>
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
            </div>}
        </div>
    );
};