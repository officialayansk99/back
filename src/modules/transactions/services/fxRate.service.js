import axios from "axios";

const FRANKFURTER_USD_INR =
  "https://api.frankfurter.app/latest?from=USD&to=INR";

/** In-memory cache so we do not hit the public API on every page load. */
let cache = { rate: null, asOfDate: null, fetchedAt: 0 };
const TTL_MS = 60 * 60 * 1000;

/**
 * Commission markup (in INR) added on top of the raw reference rate. Deposits
 * are charged this over the ECB mid-rate to cover the conversion/payment fee,
 * so the client sees (and pays) the marked-up rate. Override via env to change
 * the fee without a code change. The cache stores the raw rate, so changing
 * this takes effect immediately without waiting for the cache to expire.
 */
const USD_INR_MARKUP = Number(process.env.USD_INR_MARKUP ?? 2);

/**
 * Latest USD→INR from Frankfurter (ECB reference) plus the commission markup.
 * The reference feed updates on business days and needs no API key; the markup
 * (default +2 INR) covers the conversion fee charged on deposits.
 */
export async function fetchUsdInrRate() {
  const now = Date.now();
  if (
    cache.rate != null &&
    cache.asOfDate != null &&
    now - cache.fetchedAt < TTL_MS
  ) {
    return {
      rate: cache.rate + USD_INR_MARKUP,
      asOfDate: cache.asOfDate,
    };
  }

  const { data } = await axios.get(FRANKFURTER_USD_INR, {
    timeout: 12000,
    validateStatus: (s) => s === 200,
  });

  const rate = data?.rates?.INR;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid USD/INR in FX response");
  }

  const asOfDate =
    typeof data?.date === "string" && data.date ? data.date : null;

  cache = { rate, asOfDate, fetchedAt: now };
  return { rate: rate + USD_INR_MARKUP, asOfDate };
}
