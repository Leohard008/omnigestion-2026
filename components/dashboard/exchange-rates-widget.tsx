"use client";
import { useEffect, useState } from "react";
import { TrendingUp, RefreshCw } from "lucide-react";

interface ExchangeData {
  date: string;
  ratesFromDzd: Record<string, number>;
  cached?: boolean;
}

const currencies = [
  { code: "EUR", flag: "🇪🇺", name: "Euro" },
  { code: "USD", flag: "🇺🇸", name: "Dollar US" },
  { code: "GBP", flag: "🇬🇧", name: "Livre Sterling" },
  { code: "JPY", flag: "🇯🇵", name: "Yen Japonais" },
  { code: "CAD", flag: "🇨🇦", name: "Dollar Canadien" },
];

export function ExchangeRatesWidget() {
  const [data, setData] = useState<ExchangeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/exchange-rates");
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRates(); }, []);

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <h2 className="font-semibold text-slate-900">Taux de Change</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">vs DZD</span>
        </div>
        <button
          onClick={fetchRates}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          title="Actualiser"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {loading && !data ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {currencies.map((cur) => {
            const rate = data?.ratesFromDzd?.[cur.code];
            return (
              <div key={cur.code} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cur.flag}</span>
                  <div>
                    <span className="font-medium text-sm text-slate-900">{cur.code}</span>
                    <span className="text-xs text-slate-400 ml-1">{cur.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 tabular-nums">
                    {rate ? rate.toFixed(2) : "—"}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">DZD</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {lastUpdate && (
        <p className="text-xs text-slate-400 mt-3 text-center">
          Mis à jour: {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          {data?.cached && " (données de référence)"}
        </p>
      )}
    </div>
  );
}
