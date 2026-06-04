export const getPagination = (query: Record<string, any>, defaultPageSize = 10, maxPageSize = 200) => {
  const page = Math.max(parseInt(String(query.page || "1"), 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(String(query.pageSize || defaultPageSize), 10) || defaultPageSize, 1), maxPageSize);
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
};

