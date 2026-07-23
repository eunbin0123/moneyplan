import React, { useState } from "react";
import { Wallet, Trash2, Menu, X, ChevronLeft, ChevronRight, CalendarRange, Sun, Moon } from "lucide-react";
import { MemoTab } from "./MemoTab";
import styles from "../css/Header.module.css";

interface HeaderProps {
    months: string[];
    currentMonth: string;
    onSelectMonth: (month: string) => void;
    onDeleteMonth: (month: string) => void;
    memoStates: Record<string, boolean>;
    memo: string;
    onUpdateMemo: (newMemo: string) => void;
    memoSavingFeedback: boolean;
    shortMonthLabel: string;
    isMemoOpen: boolean;
    onToggleMemo: () => void;
    isMonthNavOpen: boolean;
    onToggleMonthNav: () => void;
    isDark: boolean;
    onToggleDark: () => void;
    onToggleHamburger: () => void;
}

export const Header: React.FC<HeaderProps> = ({
                                                  months,
                                                  currentMonth,
                                                  onSelectMonth,
                                                  onDeleteMonth,
                                                  memoStates,
                                                  memo,
                                                  onUpdateMemo,
                                                  memoSavingFeedback,
                                                  shortMonthLabel,
                                                  isMemoOpen,
                                                  onToggleMemo,
                                                  isMonthNavOpen,
                                                  onToggleMonthNav,
                                                  isDark,
                                                  onToggleDark,
                                                  onToggleHamburger,
                                              }) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    // 달 이동 네비게이션 표시 여부 (기본 숨김, 로고 클릭으로 토글)

    const hasMemoContent = !!(memo && memo.trim());

    const fullLabel = (key: string) => {
        const [y, m] = key.split("-");
        return `${y}년 ${parseInt(m, 10)}월`;
    };
    const monthOnly = (key: string) => {
        const [, m] = key.split("-");
        return `${parseInt(m, 10)}월`;
    };

    // 정렬된 달 목록에서 인접 달 계산
    const sorted = [...months].sort();
    const curIdx = sorted.indexOf(currentMonth);
    const prevMonth = curIdx > 0 ? sorted[curIdx - 1] : null;
    const nextMonth = curIdx >= 0 && curIdx < sorted.length - 1 ? sorted[curIdx + 1] : null;

    // 피커용: 연도별 그룹핑
    const byYear: Record<string, string[]> = {};
    sorted.forEach((m) => {
        const [y] = m.split("-");
        (byYear[y] = byYear[y] || []).push(m);
    });
    const years = Object.keys(byYear).sort();

    return (
        <>
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div className={styles.topRow} data-nav-open={isMonthNavOpen}>
                        <div className={styles.brand}>
                            <button
                                type="button"
                                className={styles.logoBox}
                                onClick={onToggleMonthNav}
                                title="달 이동 열기/닫기"
                                aria-expanded={isMonthNavOpen}
                            >
                                <Wallet className={styles.logoIcon} />
                            </button>

                        </div>
                        <h1 className={styles.title}>EB's MONEY</h1>
                        <div className={styles.topActions}>
                            <button
                                onClick={onToggleDark}
                                className={styles.memoBtn}
                                title={isDark ? "라이트모드" : "다크모드"}
                            >
                                {isDark ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* 달 이동: 이전/다음 + 현재월(탭하면 피커) — 로고 클릭 시 표시 */}
                    {isMonthNavOpen && (
                        <div className={styles.monthNav}>
                            <button
                                onClick={() => prevMonth && onSelectMonth(prevMonth)}
                                disabled={!prevMonth}
                                className={`${styles.navArrow} `}
                                title="Prev"
                            >
                                <ChevronLeft className={styles.navArrowIcon} />
                            </button>

                            <button
                                onClick={() => setIsPickerOpen(true)}
                                className={`${styles.monthBtn} `}
                                title="Month"
                            >
                                <CalendarRange className={styles.monthBtnIcon} />
                                {fullLabel(currentMonth)}
                            </button>

                            <button
                                onClick={() => nextMonth && onSelectMonth(nextMonth)}
                                disabled={!nextMonth}
                                className={`${styles.navArrow} `}
                                title="Next"
                            >
                                <ChevronRight className={styles.navArrowIcon} />
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* 달 선택 피커 */}
            {isPickerOpen && (
                <div className={styles.overlay} onClick={() => setIsPickerOpen(false)}>
                    <div className={`${styles.panel} `} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.panelHeader}>
                            <h2 className={styles.panelTitle}>Month</h2>
                            <div className={styles.panelHeaderActions}>
                                <button onClick={() => setIsPickerOpen(false)} className={styles.closeBtn}>
                                    <X className={styles.closeIcon} />
                                </button>
                            </div>
                        </div>

                        <div className={styles.pickerBody}>
                            {years.map((y) => (
                                <div key={y}>
                                    <p className={styles.yearLabel}>{y}년</p>
                                    <div className={styles.monthGrid}>
                                        {byYear[y].map((m) => {
                                            const isActive = m === currentMonth;
                                            const hasMemo = memoStates[m];
                                            return (
                                                <div key={m} className={styles.monthCell}>
                                                    <button
                                                        onClick={() => { onSelectMonth(m); setIsPickerOpen(false); if (isMonthNavOpen) onToggleMonthNav(); }}
                                                        className={`${styles.monthCellBtn}${isActive ? " " : ""}`}
                                                        data-active={isActive}
                                                    >
                                                        {monthOnly(m)}
                                                        {hasMemo && <span className={styles.monthMemoDot} />}
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onDeleteMonth(m); }}
                                                        title={`${monthOnly(m)} 삭제`}
                                                        className={styles.monthDeleteBtn}
                                                    >
                                                        <Trash2 className={styles.monthDeleteIcon} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 메모 모달 */}
            {isMemoOpen && (
                <div className={styles.overlay} onClick={onToggleMemo}>
                    <div className={`${styles.panel} `} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.panelHeader}>
                            <h2 className={styles.panelTitle}>{shortMonthLabel} Memo</h2>
                            <button onClick={onToggleMemo} className={styles.closeBtn}>
                                <X className={styles.closeIcon} />
                            </button>
                        </div>
                        <div className={styles.memoBody}>
                            <MemoTab
                                memo={memo}
                                onUpdateMemo={onUpdateMemo}
                                savingIndicator={memoSavingFeedback}
                                shortMonthLabel={shortMonthLabel}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};