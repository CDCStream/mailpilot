import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createApiKey, deleteApiKey, listApiKeys, renameApiKey } from "@/lib/user-api-keys";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ keys: await listApiKeys(userId) });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "");
  try {
    const result = await createApiKey(userId, name);
    return NextResponse.json({
      ok: true,
      key: result.key,
      granted: result.granted,
    });
  } catch (err) {
    const message = err instanceof Error && err.message === "invalid-name" ? "Enter a key name" : "Could not create key";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "");
  const name = String(body?.name ?? "");
  try {
    const key = await renameApiKey(userId, id, name);
    if (!key) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, key, granted: 0 });
  } catch {
    return NextResponse.json({ ok: false, error: "Enter a key name" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "");
  const ok = await deleteApiKey(userId, id);
  return NextResponse.json({ ok });
}
