import type { NextRequest } from "next/server";
import { db, ensureDb } from "@/lib/db";
import { currentTrainee } from "@/lib/trainee-auth";

/** A trainee downloads their own insurance letter. */
export async function GET(req: NextRequest) {
  const t = await currentTrainee(req);
  if (!t) return Response.json({ error: "Not signed in" }, { status: 401 });
  await ensureDb();
  const r = await db().execute({
    sql: "SELECT file_name, mime, content FROM insurance_letters WHERE trainee_id = ?",
    args: [t.id],
  });
  if (!r.rows.length) return Response.json({ error: "Not uploaded yet" }, { status: 404 });
  const row = r.rows[0];
  return new Response(new Uint8Array(Buffer.from(String(row.content), "base64")), {
    headers: {
      "Content-Type": String(row.mime),
      "Content-Disposition": `attachment; filename="${String(row.file_name).replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
