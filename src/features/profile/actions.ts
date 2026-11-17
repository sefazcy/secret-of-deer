"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { deriveIdentityRef } from "@/lib/crypto";
import { getCurrentIdentity, getCurrentProfileId } from "@/features/auth/dal";
import { MISSING_SETTINGS_MESSAGE, PhaseError } from "@/features/event/phase";
import { PARTICIPANT_COUNT_TAG } from "@/features/event/queries";
import { findFreeAlias } from "./alias";
import { aliasStepSchema, profileSchema, type ProfileInput } from "./schemas";
import { createProfileRecord, isAliasTaken, updateProfileRecord } from "./service";

type ProfileField = keyof ProfileInput;

export type AliasCheckResult = { ok: true; alias: string } | { ok: false; message: string };
export type UpdateProfileResult = { ok: true } | CreateProfileResult;
export type CreateProfileResult = {
  ok: false;
  message: string;
  fieldErrors?: Partial<Record<ProfileField, string>>;
  /** Hatanın düzeltileceği sihirbaz adımı. */
  step?: 1 | 2 | 3;
};

const STEP_OF: Record<ProfileField, 1 | 2 | 3> = {
  alias: 1,
  avatarId: 1,
  interests: 2,
  budgetTier: 2,
  giftHints: 3,
  giftExclusions: 3,
};

async function requireIdentity() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/kayit");
  return identity;
}

function parseProfile(input: ProfileInput) {
  const parsed = profileSchema.safeParse(input);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fieldErrors: Partial<Record<ProfileField, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as ProfileField;
    fieldErrors[key] ??= issue.message;
  }
  const firstField = Object.keys(fieldErrors)[0] as ProfileField;
  const error: CreateProfileResult = { ok: false, message: fieldErrors[firstField]!, fieldErrors, step: STEP_OF[firstField] };
  return { ok: false as const, error };
}

const ALIAS_TAKEN = "Bu rumuz alınmış 🦊 Başka bir tane dene ya da rastgele üret.";

/** Adım 1'den çıkarken: rumuz geçerli ve boşta mı? */
export async function checkAlias(alias: string): Promise<AliasCheckResult> {
  await requireIdentity();
  const parsed = aliasStepSchema.shape.alias.safeParse(alias);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  if (await isAliasTaken(db, parsed.data, await getCurrentProfileId())) return { ok: false, message: ALIAS_TAKEN };
  return { ok: true, alias: parsed.data };
}

/** "Rastgele rumuz üret": en fazla 20 denemede boşta olan, Hacettepe temalı bir rumuz döndürür. */
export async function suggestAlias(): Promise<string> {
  await requireIdentity();
  return findFreeAlias((candidate) => isAliasTaken(db, candidate));
}

const ALIAS_TAKEN_RESULT: CreateProfileResult = {
  ok: false,
  message: ALIAS_TAKEN,
  fieldErrors: { alias: ALIAS_TAKEN },
  step: 1,
};

function phaseErrorResult(err: unknown, wrongPhaseMessage: string): CreateProfileResult {
  if (!(err instanceof PhaseError)) throw err;
  return { ok: false, message: err.reason === "missing_settings" ? MISSING_SETTINGS_MESSAGE : wrongPhaseMessage };
}

/**
 * Sihirbazın son adımı: anonim profili oluştur ve panele yönlendir.
 * Faz kontrolü ve kayıt aynı transaction'da (eşleştirme kesinleşirken araya profil sızamaz).
 */
export async function createProfile(input: ProfileInput): Promise<CreateProfileResult> {
  const identity = await requireIdentity();

  const parsed = parseProfile(input);
  if (!parsed.ok) return parsed.error;

  let outcome;
  try {
    outcome = await createProfileRecord(db, deriveIdentityRef(identity.profileToken), parsed.data);
  } catch (err) {
    return phaseErrorResult(err, "Kayıtlar kapandı, artık yeni profil oluşturulamıyor.");
  }

  switch (outcome.status) {
    case "alias_taken":
      return ALIAS_TAKEN_RESULT;
    case "failed":
      return { ok: false, message: "Profil oluşturulamadı. Lütfen tekrar dene." };
    case "exists":
      redirect("/panel"); // Zaten profili var (ör. çift tıklama ya da ikinci sekme).
    case "created":
      updateTag(PARTICIPANT_COUNT_TAG);
      redirect("/panel");
  }
}

/**
 * Panelden profil düzenleme. Yalnızca kayıt fazında (eşleşmeler ilgi alanı ve bütçeye göre
 * yapıldığı için sonrasında değişiklik eşleşmeyi bozar). Faz kontrolü ve yazma atomik.
 */
export async function updateProfile(input: ProfileInput): Promise<UpdateProfileResult> {
  const identity = await requireIdentity();
  const parsed = parseProfile(input);
  if (!parsed.ok) return parsed.error;

  let outcome;
  try {
    outcome = await updateProfileRecord(db, deriveIdentityRef(identity.profileToken), parsed.data);
  } catch (err) {
    return phaseErrorResult(err, "Eşleşmeler yapıldıktan sonra profil değiştirilemez.");
  }

  switch (outcome.status) {
    case "no_profile":
      redirect("/profil-olustur");
    case "alias_taken":
      return ALIAS_TAKEN_RESULT;
    case "updated":
      return { ok: true };
  }
}
