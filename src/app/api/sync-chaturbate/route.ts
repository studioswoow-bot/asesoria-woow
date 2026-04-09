import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: false,
    message: "Este endpoint ha sido deshabilitado. Se ha reemplazado por la sincronización manual vía Google Drive (/api/analytics/sync-drive)."
  }, { status: 410 });
}
