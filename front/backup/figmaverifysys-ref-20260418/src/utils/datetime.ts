const pad2 = (n: number) => String(n).padStart(2, "0");

export const formatDateTime = (value: unknown): string => {
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

  const yyyy = date.getFullYear();
  const MM = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
};

export const formatDateTimeCell = (_row: unknown, _col: unknown, val: unknown) => formatDateTime(val) || "-";

