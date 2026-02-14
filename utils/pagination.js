/**
 * Pagination helper:
 * perPage supports 20 / 100 / all
 * all is capped to protect server.
 */
function parsePagination(q) {
  const page = Math.max(1, Number(q.page || 1));
  const perPageRaw = (q.perPage || q.per_page || "20").toString().toLowerCase();

  let perPage;
  if (perPageRaw === "all") perPage = "all";
  else perPage = Number(perPageRaw);

  if (![20, 100, "all"].includes(perPage)) perPage = 20;

  const capAll = 5000; // safety cap for "all"
  const limit = perPage === "all" ? capAll : perPage;
  const skip = perPage === "all" ? 0 : (page - 1) * perPage;

  return { page, perPage, limit, skip, capAll };
}

function buildMeta({ page, perPage, total, limit }) {
  if (perPage === "all") {
    return { page: 1, perPage: "all", total, totalPages: 1 };
  }
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, perPage, total, totalPages };
}

module.exports = { parsePagination, buildMeta };
