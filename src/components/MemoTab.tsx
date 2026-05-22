import React, { useRef } from "react";
import { HelpCircle, Sparkles, Check } from "lucide-react";

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
    "✈️ 여행 🗼",
    "🎂 경조사",
    "🛍 쇼핑",
    "📚 자기계발",
    "🎵 문화생활",
    "⚠️ 이번달 주의",
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
      <div className="bg-white border-2 border-black p-5 rounded-none geo-shadow space-y-5">
        {/* Speed chips insert panel */}
        <div>
          <p className="text-xs font-black text-black mb-3 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#E63946]" /> 빠른 태그 입력
          </p>
          <div className="flex flex-wrap gap-2">
            {quickChips.map((chip, i) => (
                <button
                    key={i}
                    onClick={() => handleChipClick(chip)}
                    className="text-xs text-black font-black bg-white hover:bg-black hover:text-white border-2 border-black rounded-none px-3.5 py-1.5 transition-all cursor-pointer"
                >
                  {chip}
                </button>
            ))}
          </div>
        </div>

        {/* Core Textarea editor */}
        <div>
          <label htmlFor="memo-editor" className="sr-only">메모 입력</label>
          <textarea
              id="memo-editor"
              ref={textareaRef}
              value={memo}
              onChange={(e) => onUpdateMemo(e.target.value)}
              className="w-full min-h-[160px] max-h-[350px] bg-white border-2 border-black focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none p-4 text-xs font-bold text-black leading-relaxed outline-none transition-colors placeholder:text-slate-400"
              placeholder={`이번 달 기억해야 할 것들을 자유롭게 적어두세요.\n예) 굴비적금 만기, 여행 일정, 이번 달 공과금 변동 등...`}
          />
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[10px] font-bold text-slate-470 uppercase tracking-wide gap-1 mt-1.5">
            <span className="font-mono bg-black text-white px-2 py-0.5 shrink-0 select-none">{memo.length}자</span>
          </div>
        </div>
      </div>
  );
};