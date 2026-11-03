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
