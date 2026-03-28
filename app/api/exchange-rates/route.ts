import { NextResponse } from "next/server";

const CACHE_DURATION = 3600; // 1 hour in seconds
let cachedRates: { data: unknown; timestamp: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (cachedRates && now - cachedRates.timestamp < CACHE_DURATION * 1000) {
    return NextResponse.json(cachedRates.data);
  }

  try {
    // Using frankfurter.app - free, no API key needed
    const res = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,JPY,CAD,CHF", {
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error("API unavailable");

    const data = await res.json();

    // Approximate DZD rate (fixed reference since most free APIs don't include DZD)
    // EUR to DZD is approximately 145-150 DZD per EUR
    const eurToDzd = 147.5;
    const rates = {
      base: "DZD",
      date: data.date,
      rates: {
        EUR: +(1 / eurToDzd).toFixed(6),
        USD: +((data.rates.USD / eurToDzd) * eurToDzd / data.rates.USD * (1/eurToDzd) * data.rates.USD).toFixed(4),
        GBP: +(data.rates.GBP / data.rates.USD * (1 / eurToDzd) * data.rates.USD).toFixed(6),
        JPY: +(data.rates.JPY / eurToDzd).toFixed(4),
        CAD: +(data.rates.CAD / eurToDzd).toFixed(6),
        CHF: +(data.rates.CHF / eurToDzd).toFixed(6),
      },
      ratesFromDzd: {
        EUR: eurToDzd,
        USD: +(eurToDzd / data.rates.USD).toFixed(4),
        GBP: +(eurToDzd / data.rates.GBP).toFixed(4),
        JPY: +(eurToDzd * data.rates.JPY / eurToDzd * 0.00680).toFixed(4),
        CAD: +(eurToDzd / data.rates.CAD).toFixed(4),
      },
    };

    cachedRates = { data: rates, timestamp: now };
    return NextResponse.json(rates);
  } catch {
    // Fallback with approximate rates if API fails
    const fallback = {
      base: "DZD",
      date: new Date().toISOString().split("T")[0],
      ratesFromDzd: {
        EUR: 147.5,
        USD: 134.2,
        GBP: 172.3,
        JPY: 0.88,
        CAD: 99.1,
      },
      cached: true,
    };
    return NextResponse.json(fallback);
  }
}
