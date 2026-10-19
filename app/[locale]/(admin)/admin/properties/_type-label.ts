/**
 * "hotel_apartment" → "Hotel apartment".
 *
 * Its own module, not `_filter-dropdowns.tsx`: that file is `"use client"`,
 * and the page — a server component — calls this to write "· villa" beside
 * the count. A server component cannot call a function exported from a client
 * module (it receives a client reference, not the function), so every
 * filtered view threw and the Type picker looked like it did nothing.
 */
export function propertyTypeLabel(type: string): string {
  const words = type.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
