"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { staffLogin } from "../actions";

export function StaffLoginForm() {
  const uid = useId();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!password) return setError("Şifreyi girmelisin.");
        setError(null);
        startTransition(async () => {
          // Başarılıysa sunucu role göre yönlendirir; buraya yalnızca hata döner.
          const res = await staffLogin(password);
          if (res && !res.ok) {
            setError(res.message);
            setPassword("");
            toast.error(res.message);
          }
        });
      }}
    >
      <div className="space-y-2">
        <label htmlFor={`${uid}pw`} className="block font-semibold">
          Ekip şifresi
        </label>
        <input
          id={`${uid}pw`}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          aria-invalid={!!error || undefined}
          aria-describedby={`${uid}pw-help`}
          disabled={isPending}
          className={`h-12 w-full rounded-xl border-2 bg-surface px-4 text-base outline-none transition focus:border-gold ${
            error ? "border-holly" : "border-border"
          }`}
        />
        <p id={`${uid}pw-help`} className={`text-sm ${error ? "font-medium text-holly" : "text-ink-muted"}`}>
          {error ?? "Yönetim şifresi tüm panele, saha şifresi yalnızca check-in ekranına erişir."}
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Kontrol ediliyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
