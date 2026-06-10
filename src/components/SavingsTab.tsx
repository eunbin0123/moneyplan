import React, { useState, useEffect } from "react";
import { MonthData, InstallmentItem, DebtItem } from "../types";
import { Check, Calendar, CalendarRange, Sparkles, Plus, CreditCard } from "lucide-react";
// @ts-ignore
import styles from "../css/SavingsTab.module.css";

interface SavingsTabProps {
    data: MonthData;
    onToggleAccount: (idx: number) => void;
    onAddFixed: () => void;
    onEditFixed: (idx: number) => void;
    onDeleteFixed: (idx: number) => void;
    onAddEvent: () => void;
    onDeleteEvent: (idx: number) => void;
    onUpdateSalary: (amount: number) => void;
    activeSubTab?: "distribution" | "fixed" | "installment";
    onSubTabChange?: (tab: "distribution" | "fixed" | "installment") => void;
    installments?: InstallmentItem[];
    activeMonth?: string;
    onAddInstallment?: () => void;
    onEditInstallment?: (id: string) => void;
    onDeleteInstallment?: (id: string) => void;
    debts?: DebtItem[];
    onAddDebt?: () => void;
    onEditDebt?: (id: string) => void;
    onDeleteDebt?: (id: string) => void;
}

export const SavingsTab: React.FC<SavingsTabProps> = ({
                                                          data,
                                                          onToggleAccount,
                                                          onAddFixed,
                                                          onEditFixed,
                                                          onDeleteFixed,
                                                          onAddEvent,
                                                          onDeleteEvent,
                                                          onUpdateSalary,
                                                          activeSubTab = "distribution",
                                                          onSubTabChange,
                                                          installments = [],
                                                          activeMonth = "",
                                                          onAddInstallment,
                                                          onEditInstallment,
                                                          onDeleteInstallment,
                                                          debts = [],
                                                          onAddDebt,
                                                          onEditDebt,
                                                          onDeleteDebt,
                                                      }) => {
    const formatCurrency = (amount: number) =>
        Math.round(amount).toLocaleString("ko-KR") + "원";

    const totalFixed = data.fixed.reduce((sum, item) => sum + item.amount, 0);
    const totalEvents = data.events
        ? data.events.reduce((sum, item) => sum + item.amount, 0)
        : 0;

    const monthIdx = (key: string) => {
        const [y, m] = key.split("-").map(Number);
        return y * 12 + (m - 1);
    };

    const instStatus = (it: InstallmentItem): { active: boolean; n: number } => {
        if (!activeMonth) return { active: false, n: 0 };
        const start = monthIdx(it.startMonth);
        const cur = monthIdx(activeMonth);
        if (cur < start || cur >= start + it.months) return { active: false, n: 0 };
        return { active: true, n: cur - start + 1 };
    };

    const sortedInstallments = [...installments]
        .filter((it) => instStatus(it).active)
        .sort((a, b) =>
            a.startMonth === b.startMonth
                ? a.name.localeCompare(b.name)
                : a.startMonth < b.startMonth
                    ? -1
                    : 1
        );

    const totalInstallmentThisMonth = installments.reduce(
        (sum, it) => sum + (instStatus(it).active ? it.monthlyAmount : 0),
        0
    );

    const livingBudget = data.effectiveMonthlyBudget ?? data.budget;
    const livingAmount =
        livingBudget > 0 ? livingBudget : data.accounts[0]?.amount ?? 0;

    const checkedCount = data.accounts.filter((a) => a.checked).length;
    const totalTransfer = data.accounts.reduce((sum, a, idx) => {
        if (!a.checked) return sum;
        return sum + (idx === 0 ? livingAmount : a.amount);
    }, 0);

    const salary = data.salary ?? 0;
    const remaining = salary > 0 ? salary - totalTransfer : null;
    const usedPct =
        salary > 0 ? Math.min(Math.round((totalTransfer / salary) * 100), 100) : 0;

    const [salaryInput, setSalaryInput] = useState(
        salary > 0 ? String(salary) : ""
    );
    const [isEditingSalary, setIsEditingSalary] = useState(false);

    useEffect(() => {
        setSalaryInput(salary > 0 ? String(salary) : "");
    }, [salary]);

    const handleSalarySave = () => {
        const val = parseInt(salaryInput.replace(/,/g, ""), 10);
        if (!isNaN(val) && val > 0) onUpdateSalary(val);
        setIsEditingSalary(false);
    };

    const progressBarClass =
        usedPct >= 100
            ? styles.progressBarOver
            : usedPct >= 80
                ? styles.progressBarWarning
                : styles.progressBarNormal;

    const remainingClass =
        remaining !== null && remaining < 0
            ? styles.summaryValueNegative
            : styles.summaryValueGreen;

    return (
        <div className={styles.root}>

            {/* ════════════════════════════════
                분배 탭
            ════════════════════════════════ */}
            {activeSubTab === "distribution" && (
                <div className={styles.section}>

                    {/* 월급 입력 카드 */}
                    <div className={styles.cardPad}>
                        <div className={styles.cardHeaderSimple}>
                            <p className={styles.cardTitle}>이번달 월급</p>
                            {!isEditingSalary && (
                                <button
                                    className={styles.btnSmall}
                                    onClick={() => setIsEditingSalary(true)}
                                >
                                    {salary > 0 ? "수정" : "입력"}
                                </button>
                            )}
                        </div>

                        {isEditingSalary ? (
                            <div className={styles.salaryRow}>
                                <input
                                    type="number"
                                    className={styles.salaryInput}
                                    value={salaryInput}
                                    placeholder="월급 입력 (원)"
                                    onChange={(e) => setSalaryInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSalarySave()}
                                />
                                <button className={styles.btnConfirm} onClick={handleSalarySave}>확인</button>
                                <button className={styles.btnCancel} onClick={() => setIsEditingSalary(false)}>취소</button>
                            </div>
                        ) : (
                            <p className={styles.salaryValue}>
                                {salary > 0
                                    ? formatCurrency(salary)
                                    : <span className={styles.salaryEmpty}>미입력</span>
                                }
                            </p>
                        )}
                    </div>

                    {/* 요약 카드 */}
                    <div className={styles.cardDark}>
                        <div className={styles.summaryGrid}>
                            <div>
                                <p className={styles.summaryLabel}>총 이체액</p>
                                <p className={`${styles.summaryValue} ${styles.summaryValueRed}`}>
                                    {formatCurrency(totalTransfer)}
                                </p>
                            </div>
                            <div>
                                <p className={styles.summaryLabel}>이체 진행</p>
                                <p className={styles.summaryValue}>
                                    {checkedCount} / {data.accounts.length}
                                </p>
                            </div>
                            <div>
                                <p className={styles.summaryLabel}>잔여 월급</p>
                                <p className={`${styles.summaryValue} ${remainingClass}`}>
                                    {remaining !== null ? formatCurrency(remaining) : "-"}
                                </p>
                            </div>
                        </div>

                        {salary > 0 && (
                            <div className={styles.progressWrap}>
                                <div className={styles.progressHeader}>
                                    <span>분배율</span>
                                    <span>{usedPct}%</span>
                                </div>
                                <div className={styles.progressTrack}>
                                    <div
                                        className={`${styles.progressBar} ${progressBarClass}`}
                                        style={{ width: `${usedPct}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 통장별 이체 현황 */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3 className={styles.cardTitle}>
                                <Sparkles className={styles.iconSm} style={{ color: "#E63946" }} />
                                통장별 이체 현황
                            </h3>
                        </div>

                        <div className={styles.accountList}>
                            {data.accounts.map((a, idx) => {
                                const displayAmount = idx === 0 ? livingAmount : a.amount;
                                const checked = String(a.checked);
                                return (
                                    <div
                                        key={idx}
                                        className={styles.accountRow}
                                        onClick={() => onToggleAccount(idx)}
                                    >
                                        <div className={styles.accountLeft}>
                                            <div className={styles.checkBox} data-checked={checked}>
                                                {a.checked && <Check className={styles.checkIcon} />}
                                            </div>
                                            <div>
                                                <p className={styles.accountName} data-checked={checked}>
                                                    {a.name}
                                                </p>
                                                <p className={styles.accountAmount}>
                                                    {formatCurrency(displayAmount)}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={styles.accountBadge} data-checked={checked}>
                                            {a.checked ? "완료" : "대기"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════
                고정 탭
            ════════════════════════════════ */}
            {activeSubTab === "fixed" && (
                <div className={styles.section}>

                    {/* 고정지출 */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3 className={styles.cardTitle}>
                                <Calendar className={styles.iconSm} /> 고정 지출
                            </h3>
                            <button className={styles.btnAdd} onClick={onAddFixed}>
                                <Plus className={styles.iconXs} /> 추가
                            </button>
                        </div>

                        {data.fixed.length === 0 ? (
                            <div className={styles.empty}>고정지출 목록이 비어있습니다.</div>
                        ) : (
                            <div className={styles.fixedList}>
                                {data.fixed.map((f, idx) => (
                                    <div key={idx} className={styles.fixedRow}>
                                        <div className={styles.fixedLeft}>
                                            <div className={styles.fixedDay}>
                                                {f.day
                                                    ? f.day.includes("일")
                                                        ? f.day
                                                        : `${f.day}일`
                                                    : "N/A"}
                                            </div>
                                            <span className={styles.fixedName}>{f.name}</span>
                                        </div>
                                        <div className={styles.fixedRight}>
                                            <span className={styles.fixedAmount}>
                                                -{formatCurrency(f.amount)}
                                            </span>
                                            <button className={styles.btnEdit} onClick={() => onEditFixed(idx)}>수정</button>
                                            <button className={styles.btnDelete} onClick={() => onDeleteFixed(idx)}>삭제</button>
                                        </div>
                                    </div>
                                ))}
                                <div className={styles.totalRow}>
                                    <span className={styles.totalLabel}>고정지출 총 합계</span>
                                    <span className={styles.totalValue}>-{formatCurrency(totalFixed)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 경조사비 */}
                    <div className={styles.cardAccent}>
                        <div className={styles.cardHeader}>
                            <h3 className={styles.cardTitle}>
                                <CalendarRange className={styles.iconSm} /> 경조사비
                            </h3>
                            <button className={styles.btnAdd} onClick={onAddEvent}>
                                <Plus className={styles.iconXs} /> 추가
                            </button>
                        </div>

                        {!data.events || data.events.length === 0 ? (
                            <div className={styles.empty}>
                                이번 달 경조사비 내역이 없습니다.
                            </div>
                        ) : (
                            <div className={styles.listGapMd}>
                                {data.events.map((e, idx) => (
                                    <div key={idx} className={styles.eventRow}>
                                        <span className={styles.eventName}>{e.name}</span>
                                        <div className={styles.eventRight}>
                                            <span className={styles.eventAmount}>
                                                -{formatCurrency(e.amount)}
                                            </span>
                                            <button className={styles.btnDelete} onClick={() => onDeleteEvent(idx)}>삭제</button>
                                        </div>
                                    </div>
                                ))}
                                <div className={styles.totalRow}>
                                    <span className={styles.totalLabel}>경조사비 총 합계</span>
                                    <span className={styles.totalValue}>-{formatCurrency(totalEvents)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ════════════════════════════════
                할부·당겨쓰기 탭
            ════════════════════════════════ */}
            {activeSubTab === "installment" && (
                <div className={styles.section}>

                    {/* 할부 */}
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h3 className={styles.cardTitle}>
                                <CreditCard className={styles.iconSm} /> 할부
                            </h3>
                            <button className={styles.btnAdd} onClick={onAddInstallment}>
                                <Plus className={styles.iconXs} /> 추가
                            </button>
                        </div>

                        {sortedInstallments.length === 0 ? (
                            <div className={styles.empty}>등록된 할부가 없습니다.</div>
                        ) : (
                            <div className={styles.listGap}>
                                {sortedInstallments.map((it) => {
                                    const st = instStatus(it);
                                    return (
                                        <div key={it.id} className={styles.installmentCard}>
                                            <div className={styles.installmentTop}>
                                                <div className={styles.installmentLeft}>
                                                    <span className={styles.installmentName}>{it.name}</span>
                                                    <span className={styles.installmentBadge}>
                                                        {st.n}/{it.months}회차
                                                    </span>
                                                </div>
                                                <div className={styles.installmentRight}>
                                                    <button
                                                        className={styles.btnEdit}
                                                        onClick={() => onEditInstallment && onEditInstallment(it.id)}
                                                    >수정</button>
                                                    <button
                                                        className={styles.btnDelete}
                                                        onClick={() => onDeleteInstallment && onDeleteInstallment(it.id)}
                                                    >삭제</button>
                                                </div>
                                            </div>
                                            <div className={styles.installmentMeta}>
                                                <span>
                                                    {it.startMonth} 시작 · {it.months}개월 · 총{" "}
                                                    {formatCurrency(it.totalAmount)}
                                                </span>
                                                <span className={styles.installmentMonthly}>
                                                    월 -{formatCurrency(it.monthlyAmount)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className={styles.totalRow}>
                                    <span className={styles.totalLabel}>이번 달 할부금 합계</span>
                                    <span className={styles.totalValue}>
                                        -{formatCurrency(totalInstallmentThisMonth)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 당겨쓰기 */}
                    <div className={styles.cardAccent}>
                        <div className={styles.cardHeader}>
                            <h3 className={styles.cardTitle}>🔴 당겨쓰기</h3>
                            <button className={styles.btnAdd} onClick={onAddDebt}>
                                <Plus className={styles.iconXs} /> 추가
                            </button>
                        </div>

                        {debts.length === 0 ? (
                            <div className={styles.empty}>
                                이번 달 차감할 당겨쓰기 내역이 없습니다.
                            </div>
                        ) : (
                            <div className={styles.listGap}>
                                {debts.map((d) => (
                                    <div key={d.id} className={styles.debtCard}>
                                        <div className={styles.installmentTop}>
                                            <div className={styles.installmentLeft}>
                                                <span className={styles.installmentName}>{d.name}</span>
                                            </div>
                                            <div className={styles.installmentRight}>
                                                <button
                                                    className={styles.btnEdit}
                                                    onClick={() => onEditDebt && onEditDebt(d.id)}
                                                >수정</button>
                                                <button
                                                    className={styles.btnDelete}
                                                    onClick={() => onDeleteDebt && onDeleteDebt(d.id)}
                                                >삭제</button>
                                            </div>
                                        </div>
                                        <div className={styles.installmentMeta}>
                                            <span>{d.targetMonth} 예산에서 차감</span>
                                            <span className={styles.installmentMonthly}>
                                                -{formatCurrency(d.amount)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                <div className={styles.totalRow}>
                                    <span className={styles.totalLabel}>당겨쓰기 합계</span>
                                    <span className={styles.totalValue}>
                                        -{formatCurrency(debts.reduce((s, d) => s + d.amount, 0))}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};