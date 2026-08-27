// Date helpers. The point is to keep the "today" string in ONE place so the
// dashboard streak and the outfit page don't drift across timezones.
//
// `new Date().toISOString()` always returns UTC, which means a user in Toronto
// at 8pm local gets yesterday's date string. The helpers below use the local
// components of the user's clock instead, so "today" is always the day the
// user is actually living in.

export function getTodayLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysLocal(dateStr: string, deltaDays: number): string {
  // Parsing YYYY-MM-DD as a local date (not UTC). `new Date('YYYY-MM-DD')`
  // is interpreted as UTC midnight, which would push us back/forward a day at
  // edge hours. Splicing the components ourselves keeps everything local.
  const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10))
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + deltaDays)
  return getTodayLocalDateString(dt)
}
