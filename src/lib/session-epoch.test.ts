import { test } from "node:test";
import assert from "node:assert/strict";
import { bindSessionEpoch, isSessionCurrent, type SessionData } from "./session-epoch";

test("oturum yalnızca güncel dönemdeyse geçerli", () => {
  assert.equal(isSessionCurrent({ identityId: "x", epoch: 2 }, 2), true);
  assert.equal(isSessionCurrent({ identityId: "x", epoch: 1 }, 2), false, "imhadan önceki oturum");
  assert.equal(isSessionCurrent({ staffRole: "admin" }, 0), false, "dönemsiz eski çerez");
  assert.equal(isSessionCurrent({ identityId: "x", epoch: 0 }, null), false, "ayar satırı yok");
});

test("eski dönem çerezine giriş yapılırken önceki yetkiler temizlenir", () => {
  const stale: SessionData = { identityId: "eski-kimlik", staffRole: "admin", epoch: 0 };
  bindSessionEpoch(stale, 1);
  assert.deepEqual(stale, { epoch: 1 });

  const current: SessionData = { identityId: "kimlik", epoch: 1 };
  bindSessionEpoch(current, 1);
  assert.deepEqual(current, { identityId: "kimlik", epoch: 1 }, "aynı dönemde korunur");
});
