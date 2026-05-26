/**
 * Public entry point for the preferences module. Import from `@/lib/preferences`
 * everywhere outside this folder.
 */

export {
  CURRENCIES,
  AREA_UNITS,
  CURRENCY_LABEL,
  CURRENCY_SYMBOL,
  AREA_UNIT_LABEL,
  DEFAULT_PREFERENCES,
  isCurrency,
  isAreaUnit,
  type Currency,
  type AreaUnit,
  type Locale,
  type Preferences,
} from "./types";

export { getRate, convertFromAed } from "./rates";
export {
  formatPrice,
  formatPricePerArea,
  formatArea,
  currencySymbol,
} from "./formatters";

export { PreferencesProvider, usePreferences } from "./provider";
export { PREFS_COOKIE, PREFS_COOKIE_MAX_AGE, encodePrefs, decodePrefs } from "./cookie";
