import { Prisma } from "@prisma/client";

export function fillGaps(
  results: any[],
  period: string,
  fromDate: Date,
  toDate: Date
) {
  const map = new Map<string, any>();
  for (const row of results) {
    const d = new Date(row.date);
    let key = "";
    if (period === "monthly") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    } else if (period === "weekly") {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      key = monday.toISOString().split("T")[0];
    } else {
      key = d.toISOString().split("T")[0];
    }
    map.set(key, {
      total: row.total?.toString() ?? "0",
      txCount: Number(row.txCount),
    });
  }

  const data = [];
  const current = new Date(fromDate);
  if (period === "monthly") current.setDate(1);
  if (period === "weekly") {
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    current.setDate(diff);
  }

  const end = new Date(toDate);
  
  while (current <= end) {
    const keyStr = current.toISOString().split("T")[0];
    data.push({
      date: keyStr,
      total: map.get(keyStr)?.total ?? "0",
      txCount: map.get(keyStr)?.txCount ?? 0,
    });

    if (period === "monthly") {
      current.setMonth(current.getMonth() + 1);
    } else if (period === "weekly") {
      current.setDate(current.getDate() + 7);
    } else {
      current.setDate(current.getDate() + 1);
    }
  }

  return { period, data };
}
