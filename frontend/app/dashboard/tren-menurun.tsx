"use client";

import React, { useEffect, useState } from "react";
import { dataAPI } from "@/lib/api";

interface ApiResponse {
  fullname: string;
  latest_score: number;
  trend: number;
}

interface StudentTrend {
  fullname: string;
  trend: number;
  lastScore: number;
}

interface Top5Props {
  kelas: string;
  startDate: string;
  endDate: string;
  title?: string;
  fontSize?: string;
}

export default function Top5TrenMenurun({
  kelas,
  startDate,
  endDate,
  title = "Top 5 Siswa dengan Tren Menurun",
  fontSize = "text-sm",
}: Top5Props) {
  const [data, setData] = useState<StudentTrend[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch data dari API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const response = await dataAPI.getTopLowTren(kelas, startDate, endDate);
        const result: ApiResponse[] = await response.json();

        // mapping field API → komponen
        const mapped: StudentTrend[] = result.map((r) => ({
          fullname: r.fullname,
          trend: r.trend,
          lastScore: r.latest_score,
        }));

        setData(mapped);
      } catch (err) {
        console.error("Failed fetch trend:", err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    if (!kelas || !startDate || !endDate) return;
    fetchData();
  }, [kelas, startDate, endDate]);

  // Loading dummy 5 row
  if (loading) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-md w-full animate-pulse">
        <h2 className="text-lg font-semibold mb-3">{title}</h2>

        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Ambil 5 item atau isi placeholder
  const filledRows = [...data.slice(0, 5)];
  while (filledRows.length < 5) {
    filledRows.push({ fullname: "-", trend: 0, lastScore: 0 });
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-md border border-slate-100 w-full">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className={`text-left px-3 py-2 ${fontSize}`}>Nama Lengkap</th>
            <th className={`text-left px-3 py-2 ${fontSize}`}>Tren 7 Hari</th>
            <th className={`text-left px-3 py-2 ${fontSize}`}>Skor Terakhir</th>
          </tr>
        </thead>

        <tbody>
          {filledRows.map((siswa, index) => {
            const isPlaceholder = siswa.fullname === "-";

            return (
              <tr
                key={index}
                className="border-b hover:bg-gray-50 transition-colors"
              >
                <td
                  className={`px-3 py-2 font-medium ${fontSize} ${
                    isPlaceholder ? "text-gray-400" : ""
                  }`}
                >
                  {siswa.fullname}
                </td>

                <td
                  className={`px-3 py-2 ${fontSize} ${
                    isPlaceholder
                      ? "text-gray-400"
                      : siswa.trend <= -15
                      ? "text-red-500 font-semibold"
                      : "text-gray-700"
                  }`}
                >
                  {isPlaceholder ? "-" : siswa.trend}
                </td>

                <td
                  className={`px-3 py-2 ${fontSize} ${
                    isPlaceholder ? "text-gray-400" : ""
                  }`}
                >
                  {isPlaceholder ? "-" : siswa.lastScore}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
