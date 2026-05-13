import { awsAccountPermission, type DbOrTx, db } from "@wraps/db";
import { and, eq } from "drizzle-orm";

export async function revokeAWSAccountAccess(
  params: {
    userId: string;
    awsAccountId: string;
  },
  dbOrTx: DbOrTx = db
) {
  await dbOrTx
    .delete(awsAccountPermission)
    .where(
      and(
        eq(awsAccountPermission.userId, params.userId),
        eq(awsAccountPermission.awsAccountId, params.awsAccountId)
      )
    );
}
