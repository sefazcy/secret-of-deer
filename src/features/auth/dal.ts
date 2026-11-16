import "server-only";
import { db } from "@/lib/db";
import { deriveIdentityRef } from "@/lib/crypto";
import { getSession } from "@/lib/session";

/**
 * Veri Erişim Katmanı: oturumdaki doğrulanmış öğrenci. Yoksa null.
 * Çerez okuduğu için çağıran bileşen <Suspense> içinde olmalı.
 */
export async function getCurrentIdentity() {
  const session = await getSession();
  if (!session.identityId) return null;

  const identity = await db.authIdentity.findUnique({
    where: { id: session.identityId },
    select: { id: true, isVerified: true, profileToken: true },
  });
  if (!identity?.isVerified) return null;

  return identity;
}

/** Oturumdaki öğrencinin anonim profilinin id'si (henüz oluşturmadıysa null). */
export async function getCurrentProfileId(): Promise<string | null> {
  const identity = await getCurrentIdentity();
  if (!identity) return null;
  const profile = await db.participantProfile.findUnique({
    where: { identityRef: deriveIdentityRef(identity.profileToken) },
    select: { id: true },
  });
  return profile?.id ?? null;
}
