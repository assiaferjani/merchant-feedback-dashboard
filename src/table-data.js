export function searchTableRows(rows, columns, search = "") {
  const query = search.trim().toLocaleLowerCase("fr");
  return query
    ? rows.filter((row) =>
        columns.some(({ key }) =>
          String(row[key] ?? "")
            .toLocaleLowerCase("fr")
            .includes(query),
        ),
      )
    : [...rows];
}
