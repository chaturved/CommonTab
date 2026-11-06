const pad = (n: number) => String(n).padStart(2, '0');

export const isoDate = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

export function parseIsoDate(text: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

export function monthCells(year: number, month: number): (number | null)[] {
  const leading = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(leading).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const shifted = new Date(year, month + by, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
}
