const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateKey(value) {
  const match = DATE_KEY_PATTERN.exec(String(value ?? ""));
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

export function isValidDateRange({ startDate = "", endDate = "" } = {}) {
  return (!startDate || isValidDateKey(startDate))
    && (!endDate || isValidDateKey(endDate))
    && (!startDate || !endDate || startDate <= endDate);
}

export function getDateRangeForPage(page, commercialRange, financialRange) {
  return page === "revenue" ? financialRange : commercialRange;
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getDateRangePreset(preset, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start;
  switch (preset) {
    case "7-days":
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      break;
    case "30-days":
      start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
      break;
    case "month":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "year":
      start = new Date(today.getFullYear(), 0, 1);
      break;
    default:
      return null;
  }
  return { startDate: localDateKey(start), endDate: localDateKey(today) };
}
