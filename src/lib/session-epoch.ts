/**
 * Oturum dönemi (epoch) kuralları — saf fonksiyonlar (birim testli).
 *
 * `event_settings.session_epoch` veri imhasında 1 artar. Çerezdeki `epoch` güncel dönemle
 * eşleşmiyorsa oturum (öğrenci ya da ekip) geçersizdir. Böylece imhadan önce açılmış ve
 * hâlâ tarayıcıda duran oturumlar sunucu tarafında otomatik olarak düşer.
 */

export type StaffRole = "admin" | "checkin";

export type SessionData = {
  /** Doğrulanmış öğrencinin AuthIdentity.id değeri. */
  identityId?: string;
  /** Yönetim / saha ekibi oturumu. */
  staffRole?: StaffRole;
  /** Oturumun açıldığı dönem. Yoksa (eski sürüm çerezi) geçersiz sayılır. */
  epoch?: number;
};

export function isSessionCurrent(data: SessionData, epoch: number | null): boolean {
  return epoch !== null && typeof data.epoch === "number" && data.epoch === epoch;
}

/**
 * Giriş anında oturumu güncel döneme bağlar. Çerez eski bir döneme aitse içindeki
 * tüm yetkiler önce temizlenir (eski kimlik yeni dönemde "dirilmesin").
 */
export function bindSessionEpoch(data: SessionData, epoch: number): void {
  if (data.epoch !== epoch) {
    delete data.identityId;
    delete data.staffRole;
  }
  data.epoch = epoch;
}
