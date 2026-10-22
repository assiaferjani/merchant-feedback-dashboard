export function getFinancialFileSignature(file) {
  return `${file?.name ?? ""}:${file?.size ?? 0}:${file?.lastModified ?? 0}`;
}

export async function refreshLinkedFinancialFile(handle, currentSignature, importFile) {
  if (!handle?.queryPermission || !handle?.getFile) throw new Error("Le fichier lié n’est plus accessible.");
  const permission = await handle.queryPermission({ mode: "read" });
  if (permission !== "granted") return { status: "permission-required", signature: currentSignature };
  const file = await handle.getFile();
  const signature = getFinancialFileSignature(file);
  if (signature === currentSignature) return { status: "unchanged", signature };
  const imported = await importFile(file);
  return { status: imported ? "updated" : "invalid", signature: imported ? signature : currentSignature };
}
