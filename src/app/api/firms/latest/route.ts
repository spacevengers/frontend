import { connection } from "next/server";
import { latestFirms } from "@/lib/firms/server";

export async function GET() {
  await connection();
  try {
    const data = await latestFirms();
    return Response.json(data, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch (error) {
    console.error("FIRMS download failed", error);
    return Response.json({ error: "Could not reach NASA FIRMS. Try again in a few minutes." }, { status: 502 });
  }
}
