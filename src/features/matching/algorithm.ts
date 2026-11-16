/**
 * Eşleştirme motoru — saf fonksiyonlar, veritabanına dokunmaz (test edilebilir).
 *
 * Kurallar (CLAUDE.md §5):
 *  1. Katılımcılar bütçe grubuna ayrılır; eşleşmeler grup dışına çıkmaz.
 *  2. Ağırlık = iki kişinin ortak ilgi alanı sayısı.
 *  3. Herkes tam olarak bir kişiye verir, bir kişiden alır; kimse kendisine çıkmaz.
 *     Toplam ortak ilgi alanı skoru en yüksek atama seçilir (Macar algoritması, O(n³)).
 *  4. Tek sayılı grup → admin uyarısı (gönüllü "joker" eklenmesi önerilir).
 */

export type MatchCandidate = {
  id: string;
  budgetTier: string;
  interests: readonly string[];
};

export type Assignment = {
  giverId: string;
  receiverId: string;
  commonInterestsCount: number;
};

export type GroupPlan = {
  budgetTier: string;
  size: number;
  isOdd: boolean;
  assignments: Assignment[];
  totalCommonInterests: number;
  /** En az 1 ortak ilgi alanıyla eşleşenlerin oranı (0–1). */
  withCommonInterestRatio: number;
};

export type MatchingPlan = {
  groups: GroupPlan[];
  warnings: string[];
  isValid: boolean;
};

export function countCommonInterests(a: readonly string[], b: readonly string[]): number {
  const set = new Set(a);
  let n = 0;
  for (const x of new Set(b)) if (set.has(x)) n++;
  return n;
}

/** Fisher–Yates. Eşit skorlu atamalarda kayıt sırasının sonucu belirlemesini engeller. */
function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Kare maliyet matrisinde minimum maliyetli tam atama (Macar algoritması, potansiyelli).
 * Dönüş: assignment[satır] = sütun.
 */
function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const INF = Number.MAX_SAFE_INTEGER;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0); // p[sütun] = satır (1-indeksli)
  const way = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(INF);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]!]! += delta;
          v[j]! -= delta;
        } else {
          minv[j]! -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0);
  }

  const assignment = new Array<number>(n);
  for (let j = 1; j <= n; j++) assignment[p[j]! - 1] = j - 1;
  return assignment;
}

/** Tek bir bütçe grubu için en iyi atama. Grupta en az 2 kişi olmalı. */
export function solveGroup(
  people: readonly MatchCandidate[],
  random: () => number = Math.random,
): Assignment[] {
  if (people.length < 2) return [];
  const order = shuffle(people, random);
  const n = order.length;
  const scores = order.map((a) => order.map((b) => countCommonInterests(a.interests, b.interests)));

  // Maksimizasyonu minimizasyona çevir; köşegen (kendine hediye) yasak.
  const maxScore = Math.max(0, ...scores.flat());
  const FORBIDDEN = (maxScore + 1) * (n + 1);
  const cost = scores.map((row, i) => row.map((s, j) => (i === j ? FORBIDDEN : -s)));

  const assignment = hungarian(cost);

  return assignment.map((receiverIdx, giverIdx) => {
    if (receiverIdx === giverIdx) throw new Error("Eşleştirme hatası: kendine atama üretildi.");
    return {
      giverId: order[giverIdx]!.id,
      receiverId: order[receiverIdx]!.id,
      commonInterestsCount: scores[giverIdx]![receiverIdx]!,
    };
  });
}

/** Tüm katılımcılar için grup bazlı eşleştirme planı (simülasyon ve kesinleştirme ortak kullanır). */
export function planMatching(
  people: readonly MatchCandidate[],
  random: () => number = Math.random,
): MatchingPlan {
  const byTier = new Map<string, MatchCandidate[]>();
  for (const p of people) {
    const list = byTier.get(p.budgetTier) ?? [];
    list.push(p);
    byTier.set(p.budgetTier, list);
  }

  const warnings: string[] = [];
  let isValid = true;
  const groups: GroupPlan[] = [];

  for (const [budgetTier, members] of [...byTier.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const size = members.length;
    const isOdd = size % 2 === 1;
    if (size < 2) {
      isValid = false;
      warnings.push(`${budgetTier}: grupta yalnızca ${size} kişi var, eşleştirme yapılamaz. Bir joker ekleyin.`);
    } else if (isOdd) {
      warnings.push(`${budgetTier}: grupta tek sayıda (${size}) kişi var. Bir gönüllüyü joker olarak eklemeniz önerilir.`);
    }

    const assignments = solveGroup(members, random);
    const total = assignments.reduce((s, a) => s + a.commonInterestsCount, 0);
    const withCommon = assignments.filter((a) => a.commonInterestsCount > 0).length;
    groups.push({
      budgetTier,
      size,
      isOdd,
      assignments,
      totalCommonInterests: total,
      withCommonInterestRatio: assignments.length ? withCommon / assignments.length : 0,
    });
  }

  return { groups, warnings, isValid };
}
