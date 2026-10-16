import React, { useRef, useState } from "react";
import { Sparkles, Check, Pencil, ListChecks } from "lucide-react";
// @ts-ignore
import styles from "../css/MemoTab.module.css";

interface MemoTabProps {
  memo: string;
  onUpdateMemo: (newMemo: string) => void;
  savingIndicator: boolean;
  shortMonthLabel: string;
}

export const MemoTab: React.FC<MemoTabProps> = ({
                                                  memo,
                                                  onUpdateMemo,
                                                  savingIndicator,
                                                  shortMonthLabel,
                                                }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 내용이 있으면 체크리스트 보기로, 비어 있으면 바로 편집으로 연다
  const [isEditing, setIsEditing] = useState(() => !memo.trim());

  // 완료한 줄은 앞에 "✓ " 를 붙여 저장 (기존 문자열 형식 그대로 유지)
  const DONE_PREFIX = "✓ ";
  const lines = memo.split("\n");

  // 보기 모드: 안 한 것 위, 완료한 것 아래로 모아서 표시 (저장 순서는 그대로)
  const items = lines
      .map((line, idx) => ({ idx, done: line.startsWith(DONE_PREFIX), text: line.startsWith(DONE_PREFIX) ? line.slice(DONE_PREFIX.length) : line }))
      .filter(item => item.text.trim());
  const todoItems = items.filter(item => !item.done);
  const doneItems = items.filter(item => item.done);

  const renderItem = (item: { idx: number; done: boolean; text: string }) => (
      <button
          key={item.idx}
          type="button"
          onClick={() => toggleLine(item.idx)}
          className={styles.checkItem}
          data-done={item.done}
      >
        <span className={styles.checkBox}>
          <Check className={styles.checkIcon} />
        </span>
        <span className={styles.checkText}>{item.text}</span>
      </button>
  );

  const toggleLine = (idx: number) => {
    const next = lines.map((line, i) => {
      if (i !== idx) return line;
      return line.startsWith(DONE_PREFIX) ? line.slice(DONE_PREFIX.length) : DONE_PREFIX + line;
    });
    onUpdateMemo(next.join("\n"));
  };

  const quickChips = [
    "☕", "🍽️", "🛒", "🚌", "🚗", "💊", "🎬", "👗",
    "🏋️", "🎮", "🍺", "🎁", "✂️", "📚", "🐾", "✈️",
    "🎂", "⚠️", "🪙", "🎵"
  ];

  const handleChipClick = (chip: string) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const startPos = ta.selectionStart;
    const endPos = ta.selectionEnd;
    const text = ta.value;

    const insertText = `${chip} `;
    const isNewLineNeeded = startPos > 0 && text[startPos - 1] !== "\n";
    const linePrefix = isNewLineNeeded ? "\n" : "";

    const finalInsert = `${linePrefix}${insertText}`;
    const newText =
        text.substring(0, startPos) + finalInsert + text.substring(endPos);

    onUpdateMemo(newText);

    // restore focus and pointer position
    setTimeout(() => {
      ta.focus();
      const nextPos = startPos + finalInsert.length;
      ta.setSelectionRange(nextPos, nextPos);
    }, 50);
  };

  return (
      <div className={`${styles.container} `}>
        {/* Speed chips insert panel (편집 중에만) */}
        {isEditing && (
        <div>
          <p className={styles.sectionLabel}>
            <Sparkles className={styles.sparkleIcon} /> 이모지
          </p>
          <div className={styles.chipRow}>
            {quickChips.map((chip, i) => (
                <button
                    key={i}
                    onClick={() => handleChipClick(chip)}
                    className={styles.chip}
                >
                  {chip}
                </button>
            ))}
          </div>
        </div>
        )}

        {/* 체크리스트 보기 / 편집 */}
        <div>
          <div className={styles.modeRow}>
            <span className={styles.modeHint}>
              {isEditing ? "한 줄에 하나씩 적어두세요" : "다 한 건 눌러서 줄 긋기"}
            </span>
            <button
                type="button"
                onClick={() => setIsEditing(prev => !prev)}
                className={styles.modeBtn}
            >
              {isEditing
                  ? <><ListChecks className={styles.modeIcon} /> 체크리스트</>
                  : <><Pencil className={styles.modeIcon} /> 편집</>}
            </button>
          </div>

          {isEditing ? (
              <>
                <label htmlFor="memo-editor" className={styles.srOnly}>메모 입력</label>
                <textarea
                    id="memo-editor"
                    ref={textareaRef}
                    value={memo}
                    onChange={(e) => onUpdateMemo(e.target.value)}
                    className={styles.textarea}
                    placeholder={`이번 달 기억해야 할 것들을 자유롭게 적어두세요.\n예) 굴비적금 만기, 여행 일정, 이번 달 공과금 변동 등...`}
                />
              </>
          ) : (
              <div className={styles.checklist}>
                {todoItems.length === 0 && doneItems.length > 0 && (
                    <p className={styles.allDone}>다 끝냈어요 🎉</p>
                )}
                {todoItems.map(renderItem)}
                {doneItems.length > 0 && (
                    <>
                      <p className={styles.doneDivider}>완료 {doneItems.length}</p>
                      {doneItems.map(renderItem)}
                    </>
                )}
              </div>
          )}
          <div className={styles.counterRow}>
            <span className={styles.counter}>{memo.length}자</span>
          </div>
        </div>
      </div>
  );
};