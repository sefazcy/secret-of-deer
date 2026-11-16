"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Detector = (source: HTMLVideoElement) => Promise<string | null>;

// Tarayıcının yerleşik BarcodeDetector API'si (Chrome/Android). TS kütüphanesinde tanımlı değil.
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>> };
type BarcodeDetectorCtor = {
  new (opts: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
};

/** Önce yerleşik BarcodeDetector, yoksa jsQR (iOS Safari, Firefox, masaüstü Windows). */
async function createDetector(): Promise<{ detect: Detector; engine: "native" | "jsqr" }> {
  const Native = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (Native) {
    try {
      if ((await Native.getSupportedFormats()).includes("qr_code")) {
        const detector = new Native({ formats: ["qr_code"] });
        return {
          engine: "native",
          detect: async (video) => (await detector.detect(video))[0]?.rawValue ?? null,
        };
      }
    } catch {
      // Desteklenmiyorsa jsQR'a düş.
    }
  }

  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return {
    engine: "jsqr",
    detect: async (video) => {
      if (!video.videoWidth) return null;
      // Hız için küçült: QR'ın okunması için 640px fazlasıyla yeterli.
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? null;
    },
  };
}

function cameraErrorMessage(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Kamera yalnızca güvenli bağlantıda (HTTPS) çalışır. Kodu elle girebilirsin.";
  }
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError") return "Kamera izni verilmedi. Tarayıcı ayarlarından izin ver ya da kodu elle gir.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Bu cihazda kamera bulunamadı.";
  if (name === "NotReadableError") return "Kamera başka bir uygulama tarafından kullanılıyor.";
  return "Kamera açılamadı. Kodu elle girebilirsin.";
}

const SCAN_INTERVAL_MS = 150;
/** Aynı bilet kadrajda kaldıkça tekrar gönderilmez; ancak bu süre boyunca görünmezse yeniden okunur. */
const SAME_CODE_COOLDOWN_MS = 10_000;

/**
 * Kameradan QR okur. `onScan` bir Promise döndürürse o çözülene kadar tarama duraklar
 * (aynı bilet art arda iki kez işlenmesin).
 */
export function useQrScanner(onScan: (text: string) => Promise<void> | void) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const onScanRef = useRef(onScan);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<"native" | "jsqr" | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stop = useCallback(() => {
    if (loopRef.current) clearTimeout(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("no media", "NotFoundError");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const { detect, engine } = await createDetector();
      setEngine(engine);
      setActive(true);

      const tick = async () => {
        if (!streamRef.current) return;
        if (!busyRef.current && video.readyState >= 2) {
          try {
            const text = await detect(video);
            const now = Date.now();
            const last = lastRef.current;
            if (text && text === last.text && now - last.at < SAME_CODE_COOLDOWN_MS) {
              // Bilet hâlâ kadrajda: süreyi uzat, tekrar gönderme ("zaten giriş yapmış" uyarısına dönmesin).
              lastRef.current = { text, at: now };
            } else if (text) {
              lastRef.current = { text, at: now };
              busyRef.current = true;
              try {
                await onScanRef.current(text);
              } finally {
                busyRef.current = false;
                lastRef.current = { text, at: Date.now() };
              }
            }
          } catch {
            // Tek karelik okuma hatası: sonraki karede tekrar dene.
          }
        }
        loopRef.current = window.setTimeout(tick, SCAN_INTERVAL_MS);
      };
      tick();
    } catch (err) {
      stop();
      setError(cameraErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { videoRef, start, stop, active, starting, error, engine };
}
