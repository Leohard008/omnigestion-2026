export type TokenValidation =
  | { valid: true }
  | { valid: false; reason: "NOT_FOUND" | "USED" | "EXPIRED" };

export interface ResetTokenRecord {
  usedAt: Date | null;
  expiresAt: Date;
}

export function validateResetTokenRecord(
  record: ResetTokenRecord | null,
  now: Date
): TokenValidation {
  if (!record) return { valid: false, reason: "NOT_FOUND" };
  if (record.usedAt !== null) return { valid: false, reason: "USED" };
  if (record.expiresAt < now) return { valid: false, reason: "EXPIRED" };
  return { valid: true };
}
