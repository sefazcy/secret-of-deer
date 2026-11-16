"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AVATARS,
  BUDGET_TIERS,
  BUDGET_TIER_KEYS,
  INTERESTS,
  INTEREST_LIMITS,
  TEXT_LIMITS,
  type AvatarId,
  type BudgetTierKey,
  type InterestSlug,
} from "@/lib/constants";
import { checkAlias, createProfile, suggestAlias, updateProfile } from "../actions";
import { aliasStepSchema, giftNotesStepSchema, interestsStepSchema } from "../schemas";
import { Avatar } from "./avatar";

type Step = 1 | 2 | 3;
type Field = "alias" | "avatarId" | "interests" | "budgetTier" | "giftHints" | "giftExclusions";
type Errors = Partial<Record<Field, string>>;

const STEP_TITLES: Record<Step, string> = {
  1: "Rumuzunu ve avatarını seç",
  2: "İlgi alanların ve bütçen",
  3: "Hediye ipuçların",
};

function collectErrors(issues: { path: PropertyKey[]; message: string }[]): Errors {
  const out: Errors = {};
  for (const issue of issues) out[issue.path[0] as Field] ??= issue.message;
  return out;
}

export type WizardInitial = {
  alias: string;
  avatarId: string;
  interests: InterestSlug[];
  budgetTier: BudgetTierKey;
  giftHints: string;
  giftExclusions: string;
};

/**
 * @param mode "create": yeni profil (/profil-olustur). "edit": panelden düzenleme, `initial` ile dolu gelir.
 */
export function ProfileWizard({ mode = "create", initial }: { mode?: "create" | "edit"; initial?: WizardInitial }) {
  const router = useRouter();
  // Sabit id yerine useId: Next, önceki rotaları gizli olarak DOM'da tuttuğu için sabit id'ler çakışır.
  const uid = useId();
  const [step, setStep] = useState<Step>(1);
  const [alias, setAlias] = useState(initial?.alias ?? "");
  const [avatarId, setAvatarId] = useState<AvatarId | "">((initial?.avatarId as AvatarId) ?? "");
  const [interests, setInterests] = useState<InterestSlug[]>(initial?.interests ?? []);
  const [budgetTier, setBudgetTier] = useState<BudgetTierKey | "">(initial?.budgetTier ?? "");
  const [giftHints, setGiftHints] = useState(initial?.giftHints ?? "");
  const [giftExclusions, setGiftExclusions] = useState(initial?.giftExclusions ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [isPending, startTransition] = useTransition();

  const clearError = (field: Field) => setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

  function goTo(next: Step) {
    setStep(next);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showErrors(errs: Errors) {
    setErrors(errs);
    const first = Object.values(errs).find(Boolean);
    if (first) toast.error(first);
  }

  function randomAlias() {
    startTransition(async () => {
      const suggestion = await suggestAlias();
      setAlias(suggestion);
      clearError("alias");
    });
  }

  function nextFromStep1() {
    const local = aliasStepSchema.safeParse({ alias, avatarId });
    if (!local.success) return showErrors(collectErrors(local.error.issues));
    startTransition(async () => {
      const res = await checkAlias(alias);
      if (!res.ok) return showErrors({ alias: res.message });
      setAlias(res.alias);
      goTo(2);
    });
  }

  function nextFromStep2() {
    const local = interestsStepSchema.safeParse({ interests, budgetTier });
    if (!local.success) return showErrors(collectErrors(local.error.issues));
    goTo(3);
  }

  function submit() {
    const local = giftNotesStepSchema.safeParse({ giftHints, giftExclusions });
    if (!local.success) return showErrors(collectErrors(local.error.issues));
    const input = {
      alias,
      avatarId: avatarId as AvatarId,
      interests,
      budgetTier: budgetTier as BudgetTierKey,
      giftHints,
      giftExclusions,
    };
    startTransition(async () => {
      // Oluşturmada başarılıysa sunucu /panel'e yönlendirir; buraya yalnızca hata döner.
      const res = mode === "edit" ? await updateProfile(input) : await createProfile(input);
      if (res?.ok) {
        toast.success("Profilin güncellendi ✨");
        router.push("/panel");
        return;
      }
      if (res && !res.ok) {
        if (res.step && res.step !== step) setStep(res.step);
        showErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.message);
      }
    });
  }

  function toggleInterest(slug: InterestSlug) {
    clearError("interests");
    setInterests((list) =>
      list.includes(slug) ? list.filter((s) => s !== slug) : list.length >= INTEREST_LIMITS.max ? list : [...list, slug],
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Progress step={step} />
        </div>
        {mode === "edit" && (
          <Link href="/panel" className="-mt-1 shrink-0 text-sm text-ink-muted underline underline-offset-4">
            Vazgeç
          </Link>
        )}
      </div>
      <h2 className="mt-4 text-lg font-semibold">{STEP_TITLES[step]}</h2>

      {step === 1 && (
        <div className="mt-5 space-y-6">
          <div className="space-y-2">
            <label htmlFor={`${uid}alias`} className="block font-semibold">
              Rumuzun
            </label>
            <div className="flex gap-2">
              <input
                id={`${uid}alias`}
                value={alias}
                onChange={(e) => {
                  setAlias(e.target.value);
                  clearError("alias");
                }}
                maxLength={TEXT_LIMITS.aliasMax}
                autoComplete="off"
                autoCapitalize="words"
                placeholder="ör. Beytepe Tilkisi"
                aria-invalid={!!errors.alias || undefined}
                aria-describedby={`${uid}alias-help`}
                disabled={isPending}
                className={`h-12 min-w-0 flex-1 rounded-xl border-2 bg-surface px-4 text-base outline-none transition focus:border-gold ${
                  errors.alias ? "border-holly" : "border-border"
                }`}
              />
              <button
                type="button"
                onClick={randomAlias}
                disabled={isPending}
                aria-label="Rastgele Hacettepe temalı rumuz üret"
                title="Rastgele rumuz üret"
                className="grid size-12 shrink-0 place-items-center rounded-xl border-2 border-border bg-surface text-xl transition hover:bg-surface-muted disabled:opacity-50"
              >
                🎲
              </button>
            </div>
            <FieldHint id={`${uid}alias-help`} error={errors.alias}>
              Herkes seni bu isimle görecek; gerçek adını kullanma. {alias.trim().length}/{TEXT_LIMITS.aliasMax}
            </FieldHint>
          </div>

          <fieldset>
            <legend className="font-semibold">Avatarın</legend>
            <div role="radiogroup" className="mt-3 grid grid-cols-4 gap-3">
              {AVATARS.map((a) => {
                const selected = avatarId === a.id;
                return (
                  <label
                    key={a.id}
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 p-2 text-xs transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold ${
                      selected ? "border-gold bg-surface-muted font-semibold" : "border-transparent"
                    }`}
                  >
                    <input
                      type="radio"
                      name="avatar"
                      value={a.id}
                      checked={selected}
                      onChange={() => {
                        setAvatarId(a.id);
                        clearError("avatarId");
                      }}
                      className="sr-only"
                    />
                    <Avatar avatarId={a.id} size="md" decorative />
                    {a.label}
                  </label>
                );
              })}
            </div>
            {errors.avatarId && <p className="mt-2 text-sm font-medium text-holly">{errors.avatarId}</p>}
          </fieldset>

          <Button className="w-full" onClick={nextFromStep1} disabled={isPending}>
            {isPending ? "Kontrol ediliyor…" : "Devam"}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-5 space-y-6">
          <fieldset>
            <legend className="flex w-full items-baseline justify-between font-semibold">
              İlgi alanların
              <span
                className={`text-sm font-normal tabular-nums ${
                  interests.length < INTEREST_LIMITS.min ? "text-ink-muted" : "text-pine"
                }`}
                aria-live="polite"
              >
                {interests.length}/{INTEREST_LIMITS.max} seçildi
              </span>
            </legend>
            <p className="mt-1 text-sm text-ink-muted">
              En az {INTEREST_LIMITS.min}, en fazla {INTEREST_LIMITS.max} tane seç. Eşleşmen bunlara göre yapılacak.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const selected = interests.includes(i.slug);
                const locked = !selected && interests.length >= INTEREST_LIMITS.max;
                return (
                  <button
                    key={i.slug}
                    type="button"
                    aria-pressed={selected}
                    disabled={locked}
                    onClick={() => toggleInterest(i.slug)}
                    className={`min-h-11 rounded-full border-2 px-4 text-sm font-medium transition disabled:opacity-40 ${
                      selected ? "border-pine bg-pine text-snow" : "border-border bg-surface hover:bg-surface-muted"
                    }`}
                  >
                    <span aria-hidden>{i.emoji}</span> {i.label}
                  </button>
                );
              })}
            </div>
            {errors.interests && <p className="mt-2 text-sm font-medium text-holly">{errors.interests}</p>}
          </fieldset>

          <fieldset>
            <legend className="font-semibold">Bütçe aralığın</legend>
            <p className="mt-1 text-sm text-ink-muted">Sadece aynı aralığı seçenlerle eşleşirsin.</p>
            <div role="radiogroup" className="mt-3 grid grid-cols-2 gap-3">
              {BUDGET_TIER_KEYS.map((key) => {
                const selected = budgetTier === key;
                return (
                  <label
                    key={key}
                    className={`flex min-h-16 cursor-pointer items-center justify-center rounded-xl border-2 px-3 text-center text-lg font-bold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold ${
                      selected ? "border-gold bg-night text-snow" : "border-border bg-surface"
                    }`}
                  >
                    <input
                      type="radio"
                      name="budget"
                      value={key}
                      checked={selected}
                      onChange={() => {
                        setBudgetTier(key);
                        clearError("budgetTier");
                      }}
                      className="sr-only"
                    />
                    {BUDGET_TIERS[key].label}
                  </label>
                );
              })}
            </div>
            {errors.budgetTier && <p className="mt-2 text-sm font-medium text-holly">{errors.budgetTier}</p>}
          </fieldset>

          <StepNav onBack={() => goTo(1)} onNext={nextFromStep2} disabled={isPending} nextLabel="Devam" />
        </div>
      )}

      {step === 3 && (
        <div className="mt-5 space-y-6">
          <TextArea
            id="giftHints"
            label="Hediye ipuçları"
            hint="Neleri seversin? Hangi renkler, markalar, yazarlar… (isteğe bağlı)"
            placeholder="ör. Yeşil tonları severim, kupa koleksiyonum var, Sabahattin Ali okuyorum."
            value={giftHints}
            onChange={(v) => {
              setGiftHints(v);
              clearError("giftHints");
            }}
            max={TEXT_LIMITS.giftHints}
            error={errors.giftHints}
            disabled={isPending}
          />
          <TextArea
            id="giftExclusions"
            label="İstemediğin şeyler / alerjiler"
            hint="Hediye alan kişinin bilmesi gerekenler (isteğe bağlı)"
            placeholder="ör. Fıstık alerjim var, parfüm istemem."
            value={giftExclusions}
            onChange={(v) => {
              setGiftExclusions(v);
              clearError("giftExclusions");
            }}
            max={TEXT_LIMITS.giftExclusions}
            error={errors.giftExclusions}
            disabled={isPending}
          />

          <div className="rounded-2xl border border-border bg-surface-muted p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Eşleştiğin kişi seni böyle görecek</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar avatarId={avatarId} size="md" />
              <div className="min-w-0">
                <p className="truncate font-bold">{alias}</p>
                <p className="text-sm text-ink-muted">{budgetTier && BUDGET_TIERS[budgetTier].label}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {INTERESTS.filter((i) => interests.includes(i.slug)).map((i) => (
                <span key={i.slug} className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium">
                  {i.emoji} {i.label}
                </span>
              ))}
            </div>
          </div>

          <StepNav
            onBack={() => goTo(2)}
            onNext={submit}
            disabled={isPending}
            nextLabel={
              isPending ? "Kaydediliyor…" : mode === "edit" ? "Değişiklikleri kaydet" : "Profilimi oluştur 🎄"
            }
          />
        </div>
      )}
    </div>
  );
}

function Progress({ step }: { step: Step }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-gold">Adım {step}/3</span>
      </div>
      <div
        className="mt-2 grid grid-cols-3 gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={step}
        aria-label="Profil oluşturma ilerlemesi"
      >
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1.5 rounded-full transition ${n <= step ? "bg-gold" : "bg-border"}`} />
        ))}
      </div>
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  disabled,
  nextLabel,
}: {
  onBack: () => void;
  onNext: () => void;
  disabled?: boolean;
  nextLabel: string;
}) {
  return (
    <div className="flex gap-3">
      <Button variant="ghost" onClick={onBack} disabled={disabled} className="shrink-0">
        Geri
      </Button>
      <Button onClick={onNext} disabled={disabled} className="flex-1">
        {nextLabel}
      </Button>
    </div>
  );
}

function FieldHint({ id, error, children }: { id: string; error?: string; children: ReactNode }) {
  return (
    <p id={id} className={`text-sm ${error ? "font-medium text-holly" : "text-ink-muted"}`}>
      {error ?? children}
    </p>
  );
}

function TextArea({
  id,
  label,
  hint,
  placeholder,
  value,
  onChange,
  max,
  error,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  error?: string;
  disabled?: boolean;
}) {
  const uid = useId();
  const fid = `${uid}${id}`;
  const near = value.length > max * 0.9;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor={fid} className="font-semibold">
          {label}
        </label>
        <span className={`text-sm tabular-nums ${near ? "text-holly" : "text-ink-muted"}`}>
          {value.length}/{max}
        </span>
      </div>
      <textarea
        id={fid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={max}
        rows={3}
        placeholder={placeholder}
        aria-invalid={!!error || undefined}
        aria-describedby={`${fid}-help`}
        disabled={disabled}
        className={`w-full resize-none rounded-xl border-2 bg-surface px-4 py-3 text-base outline-none transition focus:border-gold ${
          error ? "border-holly" : "border-border"
        }`}
      />
      <FieldHint id={`${fid}-help`} error={error}>
        {hint}
      </FieldHint>
    </div>
  );
}
