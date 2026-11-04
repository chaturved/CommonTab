const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDate(isoDate: string): string {
  const date = new Date(isoDate);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function longDate(isoDate: string): string {
  return `${shortDate(isoDate)}, ${new Date(isoDate).getUTCFullYear()}`;
}

export function timeAgo(thenMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - thenMs) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export function timeOfDay(ms: number): string {
  const d = new Date(ms);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

export function dayLabel(iso: string, nowMs: number): string {
  const then = new Date(iso);
  const now = new Date(nowMs);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(then, now)) return 'Today';
  const yesterday = new Date(nowMs);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(then, yesterday)) return 'Yesterday';
  return `${MONTHS[then.getMonth()]} ${then.getDate()}`;
}

export function localDateTime(isoDate: string): string {
  const d = new Date(isoDate);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}, ${timeOfDay(d.getTime())}`;
}
