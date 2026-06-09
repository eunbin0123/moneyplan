import React, { useRef } from "react";
import { HelpCircle, Sparkles, Check } from "lucide-react";
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

  const quickChips = [
    "💊 병원/약국",
    "✈️ 여행",
    "🎂 경조사",
    "🛍 쇼핑",
    "📚 자기계발",
    "🎵 문화생활",
    "⚠️ 이번달 주의",
    "🪙 할부"
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
      <div className={`${styles.container} geo-shadow`}>
        {/* Speed chips insert panel */}
        <div>
          <p className={styles.sectionLabel}>
            <Sparkles className={styles.sparkleIcon} /> 태그 입력
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

        {/* Core Textarea editor */}
        <div>
          <label htmlFor="memo-editor" className={styles.srOnly}>메모 입력</label>
          <textarea
              id="memo-editor"
              ref={textareaRef}
              value={memo}
              onChange={(e) => onUpdateMemo(e.target.value)}
              className={styles.textarea}
              placeholder={`이번 달 기억해야 할 것들을 자유롭게 적어두세요.\n예) 굴비적금 만기, 여행 일정, 이번 달 공과금 변동 등...`}
          />
          <div className={styles.counterRow}>
            <span className={styles.counter}>{memo.length}자</span>
          </div>
        </div>
      </div>
  );
};