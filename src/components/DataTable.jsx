import { searchTableRows } from "../table-data.js";
import { useMemo, useState } from "react";

export default function DataTable({
  rows,
  columns,
  label = "Données",
  pageSize = 25,
  initialSort = null,
  searchValue,
  onSearchChange,
}) {
  const [internalSearch, setInternalSearch] = useState("");
  const search = searchValue ?? internalSearch;
  const setSearch = onSearchChange ?? setInternalSearch;
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(0);
  const view = useMemo(() => {
    const filtered = searchTableRows(rows, columns, search);
    if (sort)
      filtered.sort((a, b) => {
        const first = a[sort.key],
          second = b[sort.key];
        const difference =
          first instanceof Date && second instanceof Date
            ? first - second
            : typeof first === "number" && typeof second === "number"
              ? first - second
              : String(first ?? "").localeCompare(String(second ?? ""), "fr", {
                  numeric: true,
                });
        return sort.direction === "asc" ? difference : -difference;
      });
    return filtered;
  }, [rows, columns, search, sort]);
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(view.length / pageSize) - 1),
  );
  const start = safePage * pageSize;
  const pageRows = view.slice(start, start + pageSize);
  return (
    <div className="data-table">
      <div className="table-controls">
        <label>
          Rechercher dans {label.toLocaleLowerCase("fr")}
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Saisir un mot…"
          />
        </label>
        <span role="status">
          {view.length.toLocaleString("fr-FR")} résultat(s)
        </span>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={`${label} — tableau défilant`}
      >
        <table className="commercial-table">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr>
              {columns.map(
                ({ key, label: heading, numeric, sortable = true }) => (
                  <th
                    key={key}
                    scope="col"
                    className={numeric ? "numeric-cell" : ""}
                    aria-sort={
                      sort?.key === key
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    {sortable ? (
                      <button
                        type="button"
                        aria-label={`Trier par ${heading}`}
                        onClick={() => {
                          setSort((previous) => ({
                            key,
                            direction:
                              previous?.key === key &&
                              previous.direction === "asc"
                                ? "desc"
                                : "asc",
                          }));
                          setPage(0);
                        }}
                      >
                        {heading}
                        <span aria-hidden="true">
                          {sort?.key === key
                            ? sort.direction === "asc"
                              ? " ↑"
                              : " ↓"
                            : " ↕"}
                        </span>
                      </button>
                    ) : (
                      heading
                    )}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? (
              pageRows.map((row, index) => (
                <tr key={row.tableKey ?? start + index}>
                  {columns.map(({ key, render, numeric }) => (
                    <td key={key} className={numeric ? "numeric-cell" : ""}>
                      {render
                        ? render(row[key], row)
                        : row[key] == null || row[key] === ""
                          ? "—"
                          : String(row[key])}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length}>
                  Aucun résultat. Modifiez votre recherche ou vos filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-pagination">
        <span>
          {view.length
            ? `${start + 1}–${Math.min(start + pageSize, view.length)} sur ${view.length.toLocaleString("fr-FR")}`
            : "0 résultat"}
        </span>
        <div>
          <button
            type="button"
            className="outline-button"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            aria-label={`Page précédente — ${label}`}
          >
            Précédent
          </button>
          <button
            type="button"
            className="outline-button"
            disabled={start + pageSize >= view.length}
            onClick={() => setPage(safePage + 1)}
            aria-label={`Page suivante — ${label}`}
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}
