"use client";

import { QRCodeSVG } from "qrcode.react";

/** Faz 3: kapıda okutulacak büyük QR bilet + elle girilebilecek 6 haneli yedek kod. */
export function TicketCard({
  code,
  qrPayload,
  alias,
  isCheckedIn,
}: {
  code: string;
  qrPayload: string;
  alias: string;
  isCheckedIn: boolean;
}) {
  return (
    <section aria-label="Etkinlik biletin" className="rounded-3xl bg-night p-5 text-snow shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Giriş biletin</p>
        {isCheckedIn ? (
          <span className="rounded-full bg-pine px-3 py-1 text-xs font-bold" role="status">
            ✅ Giriş yapıldı
          </span>
        ) : (
          <span className="text-xs text-white/70">{alias}</span>
        )}
      </div>

      {/* QR her zaman beyaz zemin üzerinde: koyu temada da kamera rahat okur. */}
      <div className="mx-auto mt-4 w-full max-w-[18rem] rounded-2xl bg-white p-4">
        <QRCodeSVG
          value={qrPayload}
          size={256}
          level="M"
          marginSize={0}
          title={`Bilet QR kodu: ${code}`}
          className="h-auto w-full"
        />
      </div>

      <p className="mt-4 text-center text-xs uppercase tracking-widest text-white/70">Yedek giriş kodu</p>
      <p
        className="mt-1 text-center font-mono text-4xl font-bold tracking-[0.3em] tabular-nums"
        aria-label={`Yedek giriş kodu: ${code.split("").join(" ")}`}
      >
        {code}
      </p>
      <p className="mt-3 text-center text-sm text-white/75">
        Kapıda bu ekranı göster. Okunmazsa ekran parlaklığını artır ya da kodu söyle.
      </p>
    </section>
  );
}
