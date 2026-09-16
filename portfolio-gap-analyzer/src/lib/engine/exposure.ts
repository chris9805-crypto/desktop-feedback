import {
  ASSET_CLASSES,
  CREDIT_BUCKETS,
  FACTORS,
  REGIONS,
  SECTORS,
  SIZE_BUCKETS,
  STYLE_BUCKETS,
  type AssetClass,
  type CreditBucket,
  type Currency,
  type ExposureProfile,
  type Factor,
  type Position,
  type Region,
  type Sector,
  type Security,
  type SizeBucket,
  type StyleBucket,
} from "./types";

function zeros<K extends string>(keys: readonly K[]): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const k of keys) out[k] = 0;
  return out;
}

export function emptyExposure(): ExposureProfile {
  return {
    assetClass: zeros(ASSET_CLASSES),
    region: zeros(REGIONS),
    sector: zeros(SECTORS),
    size: zeros(SIZE_BUCKETS),
    style: zeros(STYLE_BUCKETS),
    factor: zeros(FACTORS),
    credit: zeros(CREDIT_BUCKETS),
    currency: {},
    duration: 0,
    yield: 0,
    expenseRatio: 0,
    lookThrough: {},
  };
}

function sumValues(map: Partial<Record<string, number>>): number {
  return Object.values(map).reduce<number>((a, b) => a + (b ?? 0), 0);
}

/**
 * Rescale `raw` so it sums to `target`. Declared breakdowns rarely add up
 * exactly — rounding, "other" buckets, cash drag inside a fund — so the engine
 * normalises rather than trusting the source to be tidy.
 */
function normaliseTo<K extends string>(
  keys: readonly K[],
  raw: Partial<Record<K, number>>,
  target: number,
): Record<K, number> {
  const out = zeros(keys);
  const total = sumValues(raw);
  if (total <= 0 || target <= 0) return out;
  const k = target / total;
  for (const key of keys) out[key] = (raw[key] ?? 0) * k;
  return out;
}

/** Build the normalised exposure of a single security, as fractions of its own value. */
export function buildExposure(security: Security): ExposureProfile {
  const exposure = emptyExposure();

  if (security.kind === "stock") {
    const isProperty = security.sector === "realEstate";
    const equityish = 1;
    exposure.assetClass[isProperty ? "realEstate" : "equity"] = 1;
    exposure.region[security.region] = equityish;
    exposure.sector[security.sector] = equityish;
    exposure.size[security.size] = equityish;
    exposure.style[security.style] = equityish;
    for (const factor of FACTORS) {
      exposure.factor[factor] = security.factorTilts[factor] ?? 0;
    }
    exposure.currency = { [security.currency]: 1 } as Partial<Record<Currency, number>>;
    exposure.yield = security.fundamentals.dividendYield;
    exposure.expenseRatio = 0;
    exposure.duration = 0;
    exposure.lookThrough = { [security.symbol]: 1 };
    return exposure;
  }

  const b = security.breakdown;
  const assetClass = normaliseTo(ASSET_CLASSES, b.assetClass as Partial<Record<AssetClass, number>>, 1);
  const equityish = assetClass.equity + assetClass.realEstate;
  const rateSleeve = assetClass.bond + assetClass.cash;

  exposure.assetClass = assetClass;
  exposure.region = normaliseTo(REGIONS, b.region as Partial<Record<Region, number>>, equityish);
  exposure.sector = normaliseTo(SECTORS, b.sector as Partial<Record<Sector, number>>, equityish);
  exposure.size = normaliseTo(SIZE_BUCKETS, b.size as Partial<Record<SizeBucket, number>>, equityish);
  exposure.style = normaliseTo(STYLE_BUCKETS, b.style as Partial<Record<StyleBucket, number>>, equityish);
  exposure.credit = normaliseTo(CREDIT_BUCKETS, b.credit as Partial<Record<CreditBucket, number>>, rateSleeve);

  // Factor tilts are loadings, not shares, so they are scaled by how much of the
  // fund is equity rather than normalised to sum to anything.
  for (const factor of FACTORS) {
    exposure.factor[factor] = ((b.factor as Partial<Record<Factor, number>>)[factor] ?? 0) * equityish;
  }

  const declaredCurrency = b.currency as Partial<Record<Currency, number>>;
  exposure.currency = sumValues(declaredCurrency) > 0
    ? normaliseTo(
        Object.keys(declaredCurrency) as Currency[],
        declaredCurrency,
        1,
      )
    : ({ [security.currency]: 1 } as Partial<Record<Currency, number>>);

  exposure.duration = security.duration;
  exposure.yield = security.yield;
  exposure.expenseRatio = security.fund.expenseRatio;
  exposure.lookThrough = Object.fromEntries(security.topHoldings.map((h) => [h.symbol, h.weight]));
  return exposure;
}

function addScaled<K extends string>(into: Record<K, number>, from: Record<K, number>, keys: readonly K[], w: number) {
  for (const k of keys) into[k] += from[k] * w;
}

/**
 * Value-weighted sum of position exposures, plus uninvested cash.
 *
 * Cash is folded in as a cash asset-class weight in the base currency so that
 * "40% of your money is not invested" shows up in the asset-class chart rather
 * than quietly inflating every other weight.
 */
export function aggregateExposure(
  positions: Position[],
  cash: number,
  totalValue: number,
  baseCurrency: Currency,
): ExposureProfile {
  const out = emptyExposure();
  if (totalValue <= 0) return out;

  let bondWeightedDuration = 0;
  let bondWeight = 0;

  for (const position of positions) {
    const w = position.value / totalValue;
    if (w <= 0) continue;
    const e = buildExposure(position.security);

    addScaled(out.assetClass, e.assetClass, ASSET_CLASSES, w);
    addScaled(out.region, e.region, REGIONS, w);
    addScaled(out.sector, e.sector, SECTORS, w);
    addScaled(out.size, e.size, SIZE_BUCKETS, w);
    addScaled(out.style, e.style, STYLE_BUCKETS, w);
    addScaled(out.factor, e.factor, FACTORS, w);
    addScaled(out.credit, e.credit, CREDIT_BUCKETS, w);

    for (const [ccy, share] of Object.entries(e.currency)) {
      const key = ccy as Currency;
      out.currency[key] = (out.currency[key] ?? 0) + (share ?? 0) * w;
    }
    for (const [symbol, share] of Object.entries(e.lookThrough)) {
      out.lookThrough[symbol] = (out.lookThrough[symbol] ?? 0) + share * w;
    }

    out.yield += e.yield * w;
    out.expenseRatio += e.expenseRatio * w;

    const bondShare = (e.assetClass.bond + e.assetClass.cash) * w;
    bondWeightedDuration += e.duration * bondShare;
    bondWeight += bondShare;
  }

  if (cash > 0) {
    const w = cash / totalValue;
    out.assetClass.cash += w;
    out.credit.government += w;
    out.currency[baseCurrency] = (out.currency[baseCurrency] ?? 0) + w;
    bondWeight += w;
  }

  out.duration = bondWeight > 0 ? bondWeightedDuration / bondWeight : 0;
  return out;
}

/** Re-express a sleeve's buckets as shares of that sleeve rather than of the whole portfolio. */
export function normaliseSleeve<K extends string>(map: Record<K, number>, keys: readonly K[]): Record<K, number> {
  const total = keys.reduce((a, k) => a + map[k], 0);
  const out = zeros(keys);
  if (total <= 0) return out;
  for (const k of keys) out[k] = map[k] / total;
  return out;
}
