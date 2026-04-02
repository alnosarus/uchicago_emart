export function formatPrice(amount: number | null, type: "fixed" | "free" | "trade"): string {
  if (type === "free") return "Free";
  if (type === "trade") return "Trade";
  if (amount === null) return "—";
  return `$${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString();
}

export function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = new Date(start).toLocaleDateString("en-US", opts);
  const endStr = new Date(end).toLocaleDateString("en-US", opts);
  return `${startStr} – ${endStr}`;
}
