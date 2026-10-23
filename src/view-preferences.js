import { useEffect, useState } from "react";

export function readPreference(key, fallback, storage) {
  try {
    const value = JSON.parse(
      (storage ?? globalThis.localStorage)?.getItem(`solen:${key}`) ?? "null",
    );
    if (
      value === null ||
      typeof value !== typeof fallback ||
      Array.isArray(value)
    )
      return fallback;
    if (typeof fallback === "object") {
      const result = Object.fromEntries(
        Object.entries(fallback).map(([field, initial]) => [
          field,
          typeof value[field] === typeof initial ? value[field] : initial,
        ]),
      );
      if (key.endsWith("-period")) {
        const valid = (date) =>
          !date ||
          (/^\d{4}-\d{2}-\d{2}$/.test(date) &&
            !Number.isNaN(new Date(date).valueOf()));
        if (
          !valid(result.startDate) ||
          !valid(result.endDate) ||
          (result.startDate &&
            result.endDate &&
            result.startDate > result.endDate)
        )
          return fallback;
      }
      if (
        key === "settings" &&
        !["", "TND", "EUR", "USD"].includes(result.currency)
      )
        result.currency = "";
      return result;
    }
    return value;
  } catch {
    return fallback;
  }
}

export function usePreference(key, fallback) {
  const [value, setValue] = useState(() => readPreference(key, fallback));
  useEffect(() => {
    try {
      localStorage.setItem(`solen:${key}`, JSON.stringify(value));
    } catch {
      /* Preferences are optional. */
    }
  }, [key, value]);
  return [value, setValue];
}
