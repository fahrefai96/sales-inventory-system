// /src/components/Reports/ReportTable.jsx
import React from "react";

// Densities (same feel as Customers/Products)
const DENSITIES = {
  comfortable: { row: "py-3", cell: "py-3", text: "text-[15px]" },
  compact: { row: "py-2", cell: "py-2", text: "text-[14px]" },
};

// Smart compare (numeric if possible, else string)
const smartCompare = (a, b) => {
  const na = Number(a);
  const nb = Number(b);
  const aNum = Number.isFinite(na);
  const bNum = Number.isFinite(nb);
  if (aNum && bNum) return na - nb;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};

/**
 * columns: [{ key, title, render?, sortable?, align?: "left"|"right", width?, className? }]
 */
export default function ReportTable({
  columns = [],
  rows = [],
  empty = "No data",
  pageSizeOptions = [25, 50, 100],
  defaultPageSize = 25,
  density: densityProp,
}) {
  const [internalDensity, setDensity] = React.useState("comfortable");
  const density = densityProp || internalDensity;
  const [pageSize, setPageSize] = React.useState(defaultPageSize);
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState(() => {
    const firstKey = columns[0]?.key || "___";
    return { key: firstKey, dir: "asc" };
  });

  const sorted = React.useMemo(() => {
    if (!rows?.length) return [];
    const key = sortBy.key;
    const dir = sortBy.dir === "asc" ? 1 : -1;
    const sortable = columns.find((c) => c.key === key)?.sortable !== false;
    if (!key || !sortable) return rows.slice();
    return rows.slice().sort((ra, rb) => {
      const va = key in ra ? ra[key] : undefined;
      const vb = key in rb ? rb[key] : undefined;
      return smartCompare(va, vb) * dir;
    });
  }, [rows, sortBy, columns]);

  // pagination
  const total = sorted.length || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const paged = sorted.slice(startIdx, endIdx);

  React.useEffect(() => setPage(1), [pageSize, rows]);
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const dens = DENSITIES[density];

  const onHeaderClick = (key) => {
    const col = columns.find((c) => c.key === key);
    if (!col || col.sortable === false) return;
    setSortBy((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  // --- Alignment helpers with extra right padding for numeric cells ---
  const thClass = (c) =>
    `py-3 text-xs font-semibold uppercase tracking-wide ${
      c.align === "right" ? "text-right pr-6" : "text-left pl-4"
    } ${c.width || ""} ${c.className || ""}`;

  const thButtonClass = (c, isActive) =>
    `inline-flex items-center gap-1 ${
      c.align === "right" ? "justify-end" : "justify-start"
    } text-xs font-semibold uppercase tracking-wide ${
      isActive ? "text-gray-900" : "text-gray-600"
    } ${c.sortable === false ? "cursor-default" : "cursor-pointer"}`;

  const tdClass = (c) =>
    `${dens.cell} ${dens.text} ${
      c.align === "right" ? "text-right tabular-nums pr-6" : "text-left pl-4"
    } ${c.width || ""} ${c.className || ""}`;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Top toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 border-b border-gray-200">
        {/* Density - only show if not controlled by parent */}
        {!densityProp && (
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
            <button
              className={`px-3 py-2 text-xs font-medium ${
                density === "comfortable" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("comfortable")}
              title="Comfortable density"
            >
              Comfortable
            </button>
            <button
              className={`px-3 py-2 text-xs font-medium ${
                density === "compact" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setDensity("compact")}
              title="Compact density"
            >
              Compact
            </button>
          </div>
        )}

        {/* Rows per page */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows:</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-200">
            {pageSizeOptions.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPageSize(n)}
                className={`px-3 py-2 text-xs ${
                  pageSize === n ? "bg-gray-100 font-medium" : "bg-white"
                }`}
                title={`Show ${n} rows`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full table-auto">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr className="text-gray-800">
              {columns.map((c) => {
                const isActive = sortBy.key === c.key && c.sortable !== false;
                return (
                  <th key={c.key} className={thClass(c)}>
                    <button
                      className={thButtonClass(c, isActive)}
                      onClick={() => onHeaderClick(c.key)}
                      title={
                        c.sortable === false ? undefined : `Sort by ${c.title}`
                      }
                    >
                      {c.title}
                      {c.sortable === false ? null : (
                        <span className="text-[10px]">
                          {isActive ? (sortBy.dir === "asc" ? "▲" : "▼") : ""}
                        </span>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="mx-auto max-w-sm">
                    <div className="mb-2 text-lg font-semibold text-gray-800">
                      {empty}
                    </div>
                    <p className="text-sm text-gray-500">
                      Try changing filters or date range.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((row, idx) => (
                <tr
                  key={row._id || row.productId || row.id || idx}
                  className={`hover:bg-gray-50 ${dens.row}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={tdClass(c)}>
                      {c.render ? c.render(row[c.key], row) : row[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex flex-col gap-3 border-top border-t border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-gray-500">
          Showing {total === 0 ? 0 : startIdx + 1}–{endIdx} of {total}
        </span>

        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>
    </div>
  );
}

const Pagination = ({ page, setPage, totalPages }) => {
  const [jump, setJump] = React.useState(String(page));
  React.useEffect(() => setJump(String(page)), [page, totalPages]);

  const clamp = (p) => Math.max(1, Math.min(totalPages, p || 1));
  const go = (p) => setPage(clamp(p));

  const pages = [];
  const add = (p) => pages.push(p);
  const addEllipsis = () => pages.push("…");

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) add(i);
  } else {
    add(1);
    if (page > 4) addEllipsis();
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) add(i);
    if (page < totalPages - 3) addEllipsis();
    add(totalPages);
  }

  const onSubmitJump = (e) => {
    e.preventDefault();
    go(Number(jump));
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 disabled:opacity-50"
        title="Previous"
      >
        Prev
      </button>

      {pages.map((p, idx) =>
        p === "…" ? (
          <span key={`e-${idx}`} className="px-2 text-sm text-gray-500">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            className={`rounded-md border px-2 py-1 text-sm ${
              p === page
                ? "border-blue-600 text-blue-600"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            title={`Page ${p}`}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 disabled:opacity-50"
        title="Next"
      >
        Next
      </button>

      <form onSubmit={onSubmitJump} className="flex items-center gap-2 ml-2">
        <label className="text-sm text-gray-600">Jump to:</label>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Jump to page"
        />
        <button
          type="submit"
          className="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-700 hover:bg-gray-50"
        >
          Go
        </button>
        <span className="text-xs text-gray-500">/ {totalPages}</span>
      </form>
    </div>
  );
};
