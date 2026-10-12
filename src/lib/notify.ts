import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

type Tx = Prisma.TransactionClient;

export async function notify(
  userId: string,
  title: string,
  body = "",
  href = "",
  tx: Tx = db,
) {
  await tx.notification.create({ data: { userId, title, body: body.slice(0, 300), href } });
}

export async function audit(
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  detail = "",
  tx: Tx = db,
) {
  await tx.auditLog.create({
    data: { actorId, action, targetType, targetId, detail: detail.slice(0, 500) },
  });
}
