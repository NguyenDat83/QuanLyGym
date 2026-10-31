import { useState, useEffect } from "react";
import { api } from "../api";

// Tải dữ liệu từ API; path = null thì không tải
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    api
      .get(path)
      .then((d) => {
        if (alive) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e?.message || "Không tải được dữ liệu");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, tick]);
  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}

export function LoadState({ error, loading }: { error?: string; loading?: boolean }) {
  if (error) return <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>;
  if (loading) return <p className="mb-4 text-sm text-slate-400">Đang tải dữ liệu...</p>;
  return null;
}
