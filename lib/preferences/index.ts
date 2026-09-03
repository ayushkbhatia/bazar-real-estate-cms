/**
 * Public entry point for the preferences module. Import from `@/lib/preferences`
 * everywhere outside this folder.
 */

export {
  CURRENCIES,
  AREA_UNITS,
  DEFAULT_PREFERENCES,
  isCurrency,
  isAreaUnit,
  type Currency,
  type AreaUnit,
  type Locale,
  type Preferences,
} from "./types";

/**
 * The site-wide currency / area-unit dictionary. Everything that draws the
 * word "AED" or the glyph "ft²" reads it from here — see `unit-labels.ts` for
 * why the label maps that used to sit in `types.ts` are gone.
 */
export {
  DEFAULT_UNIT_LABELS,
  UNIT_LABEL_DEFAULTS,
  UNIT_LABELS_AR,
  UNIT_LABELS_EN,
  UNIT_LABEL_SETTINGS_DEFAULTS,
  labelsOf,
  resolveUnitLabels,
  unitLabelsFor,
  type AreaLabels,
  type PriceLabels,
  type UnitLabels,
  type UnitLabelOverride,
  type UnitLabelSettings,
  type UnitLabelsCtx,
} from "./unit-labels";

export {
  getRate,
  convertFromAed,
  AED_PER_USD,
  USD_PER_AED,
  RATES,
} from "./rates";
export {
  formatPrice,
  formatMoneyValue,
  formatPricePerArea,
  formatPricePerAreaValue,
  formatArea,
  formatAreaValue,
  formatAreaRange,
  areaUnitLabel,
  convertArea,
  toFt2,
  toAed,
  priceParamToInput,
  inputToPriceParam,
  currencySymbol,
  withCurrency,
  FT2_PER_M2,
} from "./formatters";

export {
  PreferencesProvider,
  UnitLabelsProvider,
  usePreferences,
  useUnitLabels,
  type LabelledPreferences,
} from "./provider";
export {
  PREFS_COOKIE,
  PREFS_COOKIE_MAX_AGE,
  encodePrefs,
  decodePrefs,
} from "./cookie";
