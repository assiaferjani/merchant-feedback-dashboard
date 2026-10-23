import { createContext, useContext } from "react";
export const SettingsContext = createContext({
  currency: "",
  scope: "combined",
});
export const useDashboardSettings = () => useContext(SettingsContext);
export function formatAmount(value, currency) {
  if (value == null) return "Indisponible";
  return currency
    ? new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value)
    : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value)} · devise non confirmée`;
}
