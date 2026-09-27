/**
 * Soft-delete helpers purs (sans Prisma) — User / Bot ne sont plus hard-deleted.
 */

export const notDeleted = { deletedAt: null } as const;

export type SoftDeletable = {
  deletedAt: Date | null;
};

export function isActiveRow(row: SoftDeletable | null | undefined): boolean {
  return Boolean(row && row.deletedAt == null);
}
