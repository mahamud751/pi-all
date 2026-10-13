export function paging(page?: number, pageSize?: number) {
  const p = Math.max(1, Number(page) || 1);
  const s = Math.min(100, Math.max(1, Number(pageSize) || 20));
  return { page: p, pageSize: s, skip: (p - 1) * s, take: s };
}

export function result<T>(data: T[], total: number, page: number, pageSize: number) {
  return { data, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export function monthStart(offset = 0) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "message\nNo rows\n";
  const headers = Object.keys(rows[0]);
  const lines = rows.map((row) => headers.map((key) => {
    const value = row[key] == null ? "" : String(row[key]);
    return `"${value.replace(/"/g, '""')}"`;
  }).join(","));
  return [headers.join(","), ...lines].join("\n");
}

export function contains(q?: string) {
  return q ? { contains: q, mode: "insensitive" as const } : undefined;
}
