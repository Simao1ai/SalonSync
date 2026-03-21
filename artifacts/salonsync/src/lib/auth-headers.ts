export function getAuthHeaders(): Record<string, string> {
  const sid = sessionStorage.getItem("__salonsync_dev_sid__");
  return sid ? { Authorization: `Bearer ${sid}` } : {};
}
