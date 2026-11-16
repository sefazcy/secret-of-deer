import { test } from "node:test";
import assert from "node:assert/strict";
import { countCommonInterests, planMatching, solveGroup, type MatchCandidate } from "./algorithm";

/** Deterministik test için basit tohumlu RNG (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAGS = ["kitap", "kahve", "oyun", "muzik", "yazilim", "sinema", "anime", "spor", "cizim"];

function randomPeople(n: number, rand: () => number, tier = "TIER_300_450"): MatchCandidate[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    budgetTier: tier,
    interests: TAGS.filter(() => rand() < 0.4),
  }));
}

function assertValidDerangement(people: MatchCandidate[], assignments: ReturnType<typeof solveGroup>) {
  const ids = people.map((p) => p.id).sort();
  assert.deepEqual(assignments.map((a) => a.giverId).sort(), ids, "herkes bir kez verir");
  assert.deepEqual(assignments.map((a) => a.receiverId).sort(), ids, "herkes bir kez alır");
  for (const a of assignments) assert.notEqual(a.giverId, a.receiverId, "kimse kendine çıkmaz");
}

test("ortak ilgi alanı sayımı tekrarları saymaz", () => {
  assert.equal(countCommonInterests(["a", "b", "b"], ["b", "b", "c"]), 1);
  assert.equal(countCommonInterests([], ["a"]), 0);
});

test("2 kişilik grup karşılıklı eşleşir", () => {
  const people = randomPeople(2, seeded(1));
  const result = solveGroup(people, seeded(2));
  assertValidDerangement(people, result);
});

test("1 kişilik grup eşleşmez ve plan geçersiz sayılır", () => {
  const plan = planMatching(randomPeople(1, seeded(1)));
  assert.equal(plan.isValid, false);
  assert.equal(plan.groups[0]!.assignments.length, 0);
});

test("farklı boyutlarda her zaman geçerli derangement üretir", () => {
  const rand = seeded(42);
  for (let n = 2; n <= 40; n++) {
    const people = randomPeople(n, rand);
    assertValidDerangement(people, solveGroup(people, rand));
  }
});

test("herkesin aynı ilgi alanlarına sahip olduğu grupta da kendine atama olmaz", () => {
  const people = Array.from({ length: 7 }, (_, i) => ({ id: `x${i}`, budgetTier: "T", interests: ["kitap"] }));
  assertValidDerangement(people, solveGroup(people, seeded(3)));
});

test("toplam skoru maksimize eder (kaba kuvvetle karşılaştırma)", () => {
  const rand = seeded(7);
  for (let round = 0; round < 25; round++) {
    const n = 2 + Math.floor(rand() * 6); // 2..7
    const people = randomPeople(n, rand);
    const got = solveGroup(people, rand).reduce((s, a) => s + a.commonInterestsCount, 0);

    let best = -1;
    const perm = people.map((_, i) => i);
    const permute = (k: number) => {
      if (k === n) {
        if (perm.every((v, i) => v !== i)) {
          const s = perm.reduce((acc, j, i) => acc + countCommonInterests(people[i]!.interests, people[j]!.interests), 0);
          best = Math.max(best, s);
        }
        return;
      }
      for (let i = k; i < n; i++) {
        [perm[k], perm[i]] = [perm[i]!, perm[k]!];
        permute(k + 1);
        [perm[k], perm[i]] = [perm[i]!, perm[k]!];
      }
    };
    permute(0);
    assert.equal(got, best, `n=${n} için optimum skor`);
  }
});

test("bütçe grupları birbirine karışmaz ve tek sayılı grup uyarı verir", () => {
  const rand = seeded(9);
  const people = [...randomPeople(5, rand, "TIER_300_450"), ...randomPeople(4, rand, "TIER_450_600")].map(
    (p, i) => ({ ...p, id: `${p.budgetTier}-${i}` }),
  );
  const plan = planMatching(people, rand);
  assert.equal(plan.isValid, true);
  assert.equal(plan.warnings.length, 1);
  for (const group of plan.groups) {
    for (const a of group.assignments) {
      assert.ok(a.giverId.startsWith(group.budgetTier) && a.receiverId.startsWith(group.budgetTier));
    }
  }
});
