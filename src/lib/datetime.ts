// Local-time helpers. The app stores schedule/reminder timestamps as
// "YYYY-MM-DDTHH:MM:SS" in *local* time (no timezone suffix) so they sort
// lexicographically and compare directly against `nowLocalIso()`.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Current local time as "YYYY-MM-DDTHH:MM:SS". */
export function nowLocalIso(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Today as "YYYY-MM-DD" in local time. */
export function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The calendar day before a "YYYY-MM-DD" date, as "YYYY-MM-DD". */
export function previousDate(date: string): string {
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
