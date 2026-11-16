"use client";

import { useEffect, useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Tüm haneler dolduğunda çağrılır. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  describedBy?: string;
};

/**
 * Tek haneli kutulardan oluşan kod girişi.
 * - Değer her zaman soldan bitişiktir (boşluklu kod oluşmaz).
 * - Yapıştırma ve SMS/e-posta otomatik doldurma (autocomplete="one-time-code") desteklenir.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  autoFocus,
  describedBy,
}: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  // En güncel değer. Odak, React yeniden render etmeden aynı olay içinde değiştiği için
  // onFocus'taki `value` bayat kalabilir; bu ref commit anında senkron güncellenir.
  const latest = useRef(value);
  useLayoutEffect(() => {
    latest.current = value;
  }, [value]);

  // Kod temizlenip (ör. hatalı deneme) giriş tekrar açıldığında ilk kutuya dön.
  useEffect(() => {
    if (autoFocus && !disabled && value === "") refs.current[0]?.focus();
  }, [autoFocus, disabled, value]);

  const focusAt = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  const commit = (next: string, focusIndex: number) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    latest.current = clean;
    onChange(clean);
    focusAt(focusIndex);
    if (clean.length === length) onComplete?.(clean);
  };

  const insertAt = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;
    const value = latest.current;
    const start = Math.min(index, value.length); // boşluk bırakmadan yaz
    // Tam kod geldiyse (yapıştırma/otomatik doldurma) baştan yaz.
    if (digits.length >= length) return commit(digits, length - 1);
    const next = value.slice(0, start) + digits + value.slice(start + digits.length);
    commit(next, start + digits.length);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    const value = latest.current;
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[i]) commit(value.slice(0, i) + value.slice(i + 1), i);
      else if (i > 0) commit(value.slice(0, i - 1) + value.slice(i), i - 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(Math.min(i + 1, value.length));
    }
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    insertAt(i, e.clipboardData.getData("text"));
  };

  return (
    <div role="group" aria-label="Doğrulama kodu" className="flex justify-between gap-2">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={value[i] ?? ""}
          onChange={(e) => insertAt(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => {
            // Boş bir kutunun ötesine atlanmasın.
            if (i > latest.current.length) focusAt(latest.current.length);
            else e.target.select();
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-label={`${i + 1}. hane`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`h-14 w-full min-w-0 max-w-14 rounded-xl border-2 bg-surface text-center text-2xl font-bold tabular-nums transition outline-none focus:border-gold disabled:opacity-60 ${
            invalid ? "border-holly" : "border-border"
          }`}
        />
      ))}
    </div>
  );
}
