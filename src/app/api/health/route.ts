import { connection } from "next/server";
import { db } from "@/lib/db";

/** Basit sağlık kontrolü: uygulama ayakta mı, veritabanına erişilebiliyor mu? */
export async function GET() {
  await connection(); // her istekte çalışsın, önbelleğe alınmasın
  try {
    const settings = await db.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
    return Response.json({ ok: true, db: "up", phase: settings?.phase ?? null });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 503 });
  }
}
