import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { dataAPI } from "@/lib/api";

interface SHIData {
  kelas: string;
  nilai: number;
}

interface Props {
  startDate: string;
  endDate: string;
}

const getColor = (v: number): string => {
  if (v < 40) return "#EF4444"; 
  if (v < 60) return "#FACC15"; 
  if (v < 80) return "#22C55E"; 
  return "#3B82F6"; 
};

export default function BarChartSHI({ startDate, endDate }: Props) {
  const [data, setData] = useState<SHIData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!startDate || !endDate) return;

    setLoading(true);

    dataAPI.getBarChart(startDate, endDate)
      .then((res) => res.json())
      .then((data) => {
        setData(data || []);
      })
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  return (
    <div className="p-6 bg-white rounded-2xl shadow-md text-center">
      <h2 className="text-2xl font-semibold mb-4">
        Perbandingan Indeks Kebahagiaan per Kelas
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        Periode: {startDate || "-"} s.d. {endDate || "-"}
      </p>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} margin={{ top: 30, right: 30, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />

            <XAxis
              dataKey="kelas"
              tick={{ fontSize: 12 }}
              angle={-15}
              textAnchor="end"
            />

            <YAxis
              tick={{ fontSize: 12 }}
              domain={[0, 100]}
              label={{
                value: "Rata-rata SHI",
                angle: -90,
                position: "insideLeft",
                offset: 10,
              }}
            />

            <Tooltip
              formatter={(value: number) => [`${value}%`, "SHI"]}
              cursor={{ fill: "rgba(0,0,0,0.05)" }}
            />

            <Bar dataKey="nilai" radius={[6, 6, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={getColor(entry.nilai)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="flex justify-center gap-3 mt-6 text-sm">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-500 rounded-sm" /> <span>{"< 40 (Risiko Tinggi)"}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-yellow-400 rounded-sm" /> <span>{"< 60 (Perlu Perhatian)"}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-500 rounded-sm" /> <span>{"< 80 (Baik)"}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-blue-500 rounded-sm" /> <span>{"≤ 100 (Sangat Baik)"}</span>
        </div>
      </div>
    </div>
  );
}
