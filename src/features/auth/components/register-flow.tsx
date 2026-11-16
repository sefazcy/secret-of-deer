"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { ALLOWED_EMAIL_DOMAINS, OTP } from "@/lib/constants";
import { useNow } from "@/lib/use-now";
import { requestOtp, verifyOtp } from "../actions";
import { requestOtpSchema } from "../schemas";

type Field = "email" | "kvkk" | "pledge";

export function RegisterFlow() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [kvkk, setKvkk] = useState(false);
  const [pledge, setPledge] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [devMode, setDevMode] = useState(false);

  const [isPending, startTransition] = useTransition();
  const now = useNow();
  const resendIn = now === null ? OTP.resendSeconds : Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  function sendCode(opts: { isResend: boolean }) {
    const input = { email, kvkk, pledge };
    const local = requestOtpSchema.safeParse(input);
    if (!local.success) {
      const errors: Partial<Record<Field, string>> = {};
      for (const issue of local.error.issues) {
        const key = issue.path[0] as Field;
        errors[key] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const res = await requestOtp(input);
      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        if (res.resendAvailableAt) {
          // Kod zaten gönderilmişti; kullanıcıyı kod ekranına geçir.
          setResendAvailableAt(res.resendAvailableAt);
          setStep("code");
        }
        toast.error(res.message);
        return;
      }
      setEmail(res.email);
      setResendAvailableAt(res.resendAvailableAt);
      setDevMode(res.devMode);
      setCode("");
      setCodeError(null);
      setStep("code");
      toast.success(opts.isResend ? "Yeni kodun yolda ✉️" : "Kodu gönderdik! E-postanı kontrol et ✉️");
    });
  }

  function submitCode(value: string) {
    if (value.length !== OTP.length || isPending) return;
    setCodeError(null);
    startTransition(async () => {
      // Başarılı olursa sunucu yönlendirir; buraya yalnızca hata döner.
      const res = await verifyOtp({ email, code: value });
      if (res && !res.ok) {
        setCode("");
        setCodeError(res.message);
        toast.error(res.message);
      }
    });
  }

  function onEmailSubmit(e: FormEvent) {
    e.preventDefault();
    sendCode({ isResend: false });
  }

  if (step === "code") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitCode(code);
        }}
        className="space-y-5"
        noValidate
      >
        <div>
          <h2 className="text-lg font-semibold">Kodu gir</h2>
          <p className="mt-1 text-sm text-ink-muted">
            <span className="font-medium text-ink">{email}</span> adresine {OTP.length} haneli bir kod gönderdik. Kod{" "}
            {OTP.ttlMinutes} dakika geçerli. Gelmediyse gereksiz (spam) klasörüne de bak.
          </p>
        </div>

        {devMode && (
          <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-ink-muted">
            🛠️ Geliştirme modu: kod e-posta yerine sunucu terminaline yazıldı.
          </p>
        )}

        <OtpInput
          value={code}
          onChange={(v) => {
            setCode(v);
            if (codeError) setCodeError(null);
          }}
          onComplete={submitCode}
          length={OTP.length}
          disabled={isPending}
          invalid={!!codeError}
          describedBy={codeError ? "otp-error" : undefined}
          autoFocus
        />
        {codeError && (
          <p id="otp-error" role="alert" className="text-sm font-medium text-holly">
            {codeError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending || code.length !== OTP.length}>
          {isPending ? "Kontrol ediliyor…" : "Doğrula ve devam et"}
        </Button>

        <div className="flex flex-col items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => sendCode({ isResend: true })}
            disabled={isPending || resendIn > 0}
            className="min-h-11 font-semibold text-ink underline underline-offset-4 disabled:cursor-not-allowed disabled:text-ink-muted disabled:no-underline"
          >
            {resendIn > 0 ? `Kodu tekrar gönder (${resendIn} sn)` : "Kodu tekrar gönder"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setCodeError(null);
            }}
            disabled={isPending}
            className="min-h-11 text-ink-muted underline underline-offset-4"
          >
            E-posta adresini değiştir
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onEmailSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="email" className="block font-semibold">
          Hacettepe e-posta adresin
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="ad.soyad@ogr.hacettepe.edu.tr"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }));
          }}
          aria-invalid={!!fieldErrors.email || undefined}
          aria-describedby="email-help"
          disabled={isPending}
          className={`h-12 w-full rounded-xl border-2 bg-surface px-4 text-base outline-none transition focus:border-gold ${
            fieldErrors.email ? "border-holly" : "border-border"
          }`}
        />
        <p id="email-help" className={`text-sm ${fieldErrors.email ? "font-medium text-holly" : "text-ink-muted"}`}>
          {fieldErrors.email ?? `Sadece ${ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(" veya ")} adresleri kabul edilir.`}
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="sr-only">Onaylar</legend>
        <Consent
          id="kvkk"
          checked={kvkk}
          onChange={(v) => {
            setKvkk(v);
            setFieldErrors((f) => ({ ...f, kvkk: undefined }));
          }}
          error={fieldErrors.kvkk}
          disabled={isPending}
        >
          <Link href="/gizlilik-kvkk" target="_blank" className="font-semibold underline underline-offset-4">
            KVKK aydınlatma metnini
          </Link>{" "}
          okudum; verilerimin etkinlik sonrası silinmek üzere işlenmesini onaylıyorum.
        </Consent>
        <Consent
          id="pledge"
          checked={pledge}
          onChange={(v) => {
            setPledge(v);
            setFieldErrors((f) => ({ ...f, pledge: undefined }));
          }}
          error={fieldErrors.pledge}
          disabled={isPending}
        >
          Eşleştiğim kişiye hediye alacağıma ve <strong>etkinliğe hediyesiz gelmeyeceğime</strong> söz veriyorum. 🎁
        </Consent>
      </fieldset>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Gönderiliyor…" : "Doğrulama kodu gönder"}
      </Button>
    </form>
  );
}

function Consent({
  id,
  checked,
  onChange,
  error,
  disabled,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className={`flex cursor-pointer gap-3 rounded-xl border-2 bg-surface p-4 text-sm leading-relaxed transition ${
          error ? "border-holly" : checked ? "border-pine" : "border-border"
        }`}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-5 shrink-0 accent-[var(--pine)]"
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium text-holly">
          {error}
        </p>
      )}
    </div>
  );
}
