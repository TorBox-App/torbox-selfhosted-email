import { awsAccountPermission, type DbOrTx, db } from "@wraps/db";
import { eq } from "drizzle-orm";
import { PERMISSION_LEVELS, type PermissionLevel } from "./types";

export async function grantAWSAccountAccess(
  params: {
    userId: string;
    awsAccountId: string;
    permissions: PermissionLevel;
    grantedBy: string;
    expiresAt?: Date;
  },
  dbOrTx: DbOrTx = db
) {
  const permissionList = PERMISSION_LEVELS[params.permissions];

  const existing = await dbOrTx.query.awsAccountPermission.findFirst({
    where: (p, { and, eq }) =>
      and(eq(p.userId, params.userId), eq(p.awsAccountId, params.awsAccountId)),
  });

  if (existing) {
    await dbOrTx
      .update(awsAccountPermission)
      .set({
        permissions: [...permissionList],
        expiresAt: params.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(awsAccountPermission.id, existing.id));
  } else {
    await dbOrTx.insert(awsAccountPermission).values({
      userId: params.userId,
      awsAccountId: params.awsAccountId,
      permissions: [...permissionList],
      grantedBy: params.grantedBy,
      expiresAt: params.expiresAt,
    });
  }
}
