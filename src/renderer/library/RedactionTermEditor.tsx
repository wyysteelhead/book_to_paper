import { X } from "lucide-react";
import { useState } from "react";

type RedactionTermEditorProps = {
  disabled?: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

export function RedactionTermEditor({
  disabled,
  onChange,
  placeholder = "输入后按空格或回车",
  value
}: RedactionTermEditorProps): JSX.Element {
  const [draft, setDraft] = useState("");
  const terms = parseTerms(value);

  const commit = (raw: string): void => {
    const nextTerms = uniqueTerms([...terms, ...parseTerms(raw)]);
    onChange(nextTerms.join("\n"));
    setDraft("");
  };

  const remove = (term: string): void => {
    onChange(terms.filter((item) => item !== term).join("\n"));
  };

  return (
    <div className="term-editor" aria-label="屏蔽词编辑器">
      <div className="term-chip-list">
        {terms.map((term) => (
          <span className="term-chip" key={term}>
            {term}
            <button type="button" onClick={() => remove(term)} disabled={disabled} aria-label={`移除${term}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " " || event.key === "," || event.key === "，") {
              event.preventDefault();
              commit(draft);
            }
            if (event.key === "Backspace" && !draft && terms.length > 0) {
              remove(terms[terms.length - 1]);
            }
          }}
          onBlur={() => commit(draft)}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (parseTerms(text).length <= 1) return;
            event.preventDefault();
            commit(text);
          }}
          disabled={disabled}
          placeholder={terms.length === 0 ? placeholder : ""}
        />
      </div>
    </div>
  );
}

function parseTerms(input: string): string[] {
  return input
    .split(/[\n,，、;；\s]+/g)
    .map((term) => term.trim())
    .filter(Boolean);
}

function uniqueTerms(terms: string[]): string[] {
  return [...new Set(terms)];
}
