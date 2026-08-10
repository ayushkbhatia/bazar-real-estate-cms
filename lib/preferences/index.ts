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

export {
  getRate,
  convertFromAed,
  setLiveRates,
  resetLiveRates,
  AED_PER_USD,
  USD_PER_AED,
  STATIC_RATES,
  type FxRates,
} from "./rates";
export {
  formatPrice,
  formatPricePerArea,
  formatArea,
  formatAreaValue,
  formatAreaRange,
  areaUnitLabel,
  convertArea,
  toFt2,
  currencySymbol,
  FT2_PER_M2,
} from "./formatters";

export { PreferencesProvider, usePreferences } from "./provider";
export { PREFS_COOKIE, PREFS_COOKIE_MAX_AGE, encodePrefs, decodePrefs } from "./cookie";
