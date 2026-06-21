export type AdminSortField = 'duration' | 'date';
export type AdminSortDir = 'asc' | 'desc';

export interface AdminTableItem {
  title: string;
  description?: string | null;
  duration_secs?: number | null;
  published_at?: string | null;
}

export const filterAdminItems = <T extends AdminTableItem>(items: T[], query: string): T[] => {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      (item.description?.toLowerCase().includes(q) ?? false)
  );
};

export const sortAdminItems = <T extends AdminTableItem>(
  items: T[],
  field: AdminSortField | null,
  dir: AdminSortDir
): T[] => {
  if (!field) return items;
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (field === 'duration') {
      cmp = (a.duration_secs ?? 0) - (b.duration_secs ?? 0);
    } else {
      const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
      const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
      cmp = aTime - bTime;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
};

export const nextSortState = (
  field: AdminSortField,
  currentField: AdminSortField | null,
  currentDir: AdminSortDir
): { field: AdminSortField; dir: AdminSortDir } => {
  if (currentField === field) {
    return { field, dir: currentDir === 'asc' ? 'desc' : 'asc' };
  }
  return { field, dir: field === 'date' ? 'desc' : 'asc' };
};
