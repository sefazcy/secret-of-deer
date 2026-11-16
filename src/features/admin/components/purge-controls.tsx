"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { purgeAllData } from "../actions";
import { PURGE_CONFIRMATION, isPurgeConfirmed } from "../purge-confirmation";

/**
 * Çift onay: 1) "Etkinliği sonlandır" butonu uyarıyı açar, 2) onay ifadesi birebir yazılmadan
 * imha butonu etkinleşmez. Sunucu da ifadeyi ayrıca doğrular.
 */
export function PurgeControls() {
  const uid = useId();
  const [step, setStep] = useState<0 | 1>(0);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const ready = isPurgeConfirmed(text);

  if (step === 0) {
    return (
      <Button variant="ghost" className="w-full border-holly text-holly" onClick={() => setStep(1)}>
        🔥 Etkinliği sonlandır ve kişisel verileri imha et
      </Button>
    );
  }

  return (
    <div role="alertdialog" aria-labelledby={`${uid}title`} className="space-y-3 rounded-xl border-2 border-holly bg-holly/5 p-4">
      <p id={`${uid}title`} className="font-bold text-holly">
        ⚠️ Bu işlem geri alınamaz
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>Tüm e-posta adresleri, profiller, ilgi alanları ve eşleşmeler kalıcı olarak silinir.</li>
        <li>Öğrenciler panele bir daha giriş yapamaz; etkinlik “sona erdi” olarak işaretlenir.</li>
        <li>Veritabanı dosyası yeniden yazılır (VACUUM); silinen veri dosyada iz bırakmaz.</li>
      </ul>
      <div className="space-y-1">
        <label htmlFor={`${uid}confirm`} className="block text-sm font-semibold">
          Onaylamak için <span className="font-mono">{PURGE_CONFIRMATION}</span> yaz
        </label>
        <input
          id={`${uid}confirm`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          disabled={isPending}
          className="h-12 w-full rounded-xl border-2 border-border bg-surface px-4 font-mono outline-none focus:border-holly"
        />
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setStep(0);
            setText("");
          }}
          disabled={isPending}
        >
          Vazgeç
        </Button>
        <Button
          className="flex-1"
          disabled={!ready || isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await purgeAllData(text);
              if (res.ok) toast.success(res.message, { duration: 10_000 });
              else toast.error(res.message);
            })
          }
        >
          {isPending ? "İmha ediliyor…" : "Kalıcı olarak imha et"}
        </Button>
      </div>
    </div>
  );
}
