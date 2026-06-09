import { BudgetState } from "../types";
import { calculateBudgetWithCarryOver } from "./budgetCalculator";

const SPREADSHEET_KEY = "smart_budget_google_sheet_id";

export function getSavedSpreadsheetId(): string | null {
  return localStorage.getItem(SPREADSHEET_KEY);
}

export function saveSpreadsheetId(id: string) {
  localStorage.setItem(SPREADSHEET_KEY, id);
}

export function removeSpreadsheetId() {
  localStorage.removeItem(SPREADSHEET_KEY);
}

export async function createGoogleSheet(accessToken: string): Promise<string> {
  const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: "스마트 가계부 (실시간 동기화 - 구글 시트)",
      },
      sheets: [
        { properties: { title: "종합 개요" } },
        { properties: { title: "지출 내역" } },
        { properties: { title: "고정 및 경조사 지출" } },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "스프레드시트를 생성하지 못했습니다.");
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;

  if (spreadsheetId) {
    saveSpreadsheetId(spreadsheetId);
  }

  return spreadsheetId;
}

export async function syncToGoogleSheet(
    accessToken: string,
    spreadsheetId: string,
    months: string[],
    budgetState: BudgetState
): Promise<void> {
  const computedState = calculateBudgetWithCarryOver(months, budgetState);
  const sortedMonths = [...months].sort();

  // 1. Prepare "종합 개요" Grid
  const overviewRows: (string | number)[][] = [
    ["스마트 가계부 종합 개요 백업 리포트", "", "", "", "", "최종 동기화: " + new Date().toLocaleString("ko-KR")],
    [],
    ["연월", "구분", "지정/이월포함 예산(원)", "실제 지출액(원)", "남은 잔액(원)", "소비 비율 %"],
  ];


  sortedMonths.forEach((m) => {
    const calc = computedState[m];
    if (!calc) return;

    const effL = calc.effectiveMonthlyBudget;

    // Living
    overviewRows.push([
      m,
      "생활비(주기별 합산)",
      effL,
      calc.totalLivingSpent,
      calc.remainingLiving,
      calc.effectiveMonthlyBudget > 0 ? `${Math.round((calc.totalLivingSpent / calc.effectiveMonthlyBudget) * 100)}%` : "0%",
    ]);

    // Fixed
    const fixedAlloc = calc.fixedBudget ?? 160000;
    overviewRows.push([
      m,
      "고정 지출",
      fixedAlloc,
      calc.totalFixedSpent,
      calc.remainingFixed,
      fixedAlloc > 0 ? `${Math.round((calc.totalFixedSpent / fixedAlloc) * 100)}%` : "0%",
    ]);

    // Event
    const eventAlloc = calc.eventBudget ?? 200000;
    overviewRows.push([
      m,
      "경조사비",
      eventAlloc,
      calc.totalEventSpent,
      calc.remainingEvent,
      eventAlloc > 0 ? `${Math.round((calc.totalEventSpent / eventAlloc) * 100)}%` : "0%",
    ]);

    // Total Combined
    overviewRows.push([
      m,
      "월 총합계",
      calc.totalCombinedBudget,
      calc.totalCombinedSpent,
      calc.totalCombinedRemaining,
      calc.totalCombinedBudget > 0 ? `${Math.round((calc.totalCombinedSpent / calc.totalCombinedBudget) * 100)}%` : "0%",
    ]);

    overviewRows.push([]); // spacer row
  });

  // 2. Prepare "지출 내역" Grid
  const expenseRows: (string | number)[][] = [
    ["연월", "날짜", "주기 기간", "주기 구분", "지출 내역", "금액(원)", "결제상태"],
  ];


  sortedMonths.forEach((m) => {
    const calc = computedState[m];
    if (!calc) return;

    const flatExps = calc.expenses || [];
    flatExps.forEach((e) => {
      const matchedCycle = calc.cycles.find((c) => e.date >= c.start && e.date <= c.end);
      const cycleText = matchedCycle ? matchedCycle.label.replace(/\s*\(.*?\)\s*/g, "").trim() : "해당 없음";
      const cycleRange = matchedCycle ? `${matchedCycle.start} ~ ${matchedCycle.end}` : "-";

      expenseRows.push([
        m,
        e.date,
        cycleRange,
        cycleText,
        e.name,
        e.amount,
        e.paid === true ? "결제완료" : "결제대기",
      ]);
    });
  });

  // 3. Prepare "고정 및 경조사 지출" Grid
  const fixedAndEventRows: (string | number)[][] = [
    ["연월", "대분류", "지불예정일/일자명", "지출 항목명", "금액(원)"],
  ];


  sortedMonths.forEach((m) => {
    const calc = computedState[m];
    if (!calc) return;

    // Fixed list
    const fixedList = calc.fixed || [];
    fixedList.forEach((f) => {
      fixedAndEventRows.push([
        m,
        "고정 지출",
        f.day || "매월",
        f.name,
        f.amount,
      ]);
    });

    // Events list
    const eventList = calc.events || [];
    eventList.forEach((ev) => {
      fixedAndEventRows.push([
        m,
        "경조사비",
        "비정기",
        ev.name,
        ev.amount,
      ]);
    });
  });

  // Execute batchClear
  const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ranges: [
        "'종합 개요'!A1:Z5000",
        "'지출 내역'!A1:Z10000",
        "'고정 및 경조사 지출'!A1:Z5000",
      ],
    }),
  });

  if (!clearResponse.ok) {
    throw new Error("시트의 이전 기록을 지우는 중 오류가 발생했습니다.");
  }

  // Execute batchUpdate
  const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: "'종합 개요'!A1",
          values: overviewRows,
        },
        {
          range: "'지출 내역'!A1",
          values: expenseRows,
        },
        {
          range: "'고정 및 경조사 지출'!A1",
          values: fixedAndEventRows,
        },
      ],
    }),
  });

  if (!updateResponse.ok) {
    const errorData = await updateResponse.json();
    throw new Error(errorData.error?.message || "스프레드시트에 데이터를 동기화하지 못했습니다.");
  }
}