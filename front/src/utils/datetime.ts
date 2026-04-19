const pad2 = (n: number) => String(n).padStart(2, "0");

const formatByPattern = (date: Date, pattern: string) => {
  const tokens: Record<string, string> = {
    yyyy: String(date.getFullYear()),
    MM: pad2(date.getMonth() + 1),
    dd: pad2(date.getDate()),
    hh: pad2(date.getHours()),
    mm: pad2(date.getMinutes()),
    ss: pad2(date.getSeconds()),
  };

  return pattern.replace(/yyyy|MM|dd|hh|mm|ss/g, (token) => tokens[token] || token);
};

export const formatDateTime = (
  value: unknown,
  pattern = "yyyy-MM-dd hh:mm:ss"
): string => {
  if (value === null || typeof value === "undefined" || value === "") return "";

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    date = new Date(value);
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^\d+$/.test(trimmed)) date = new Date(Number(trimmed));
    else date = new Date(trimmed);
  } else {
    return "";
  }

  if (Number.isNaN(date.getTime())) return "";

  return formatByPattern(date, pattern);
};

export const formatDateTimeCell = (_row: unknown, _col: unknown, val: unknown) => formatDateTime(val) || "-";
