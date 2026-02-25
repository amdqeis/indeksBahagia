"use client";

import React, { useEffect, useState } from "react";
import { dataAPI } from "@/lib/api";

interface HeatmapProps {
  kelas: string;
  startDate: string;
  endDate: string;
}

export default function HeatmapKebahagiaan({
  kelas,
  startDate,
  endDate
}: HeatmapProps){
  const [students, setStudents] = useState<string[]>([]);
  const [datesList, setDatesList] = useState<string[]>([]);
  const [values, setValues] = useState<Array<Array<number | null>>>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const limit = 20;

  // Screen size detection
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    const checkSize = () => setIsSmallScreen(window.innerWidth < 768);
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  useEffect(() => {
    if (!kelas || !startDate || !endDate) return;
    fetchHeatmap(page);
  }, [page, kelas, startDate, endDate]);

  useEffect(() => {
    setPage(1);
  }, [kelas, startDate, endDate]);

  // Fetch Data
  const fetchHeatmap = async (pageNumber: number) => {
    try {
      const response = await dataAPI.getHeatMap(kelas|| "", startDate, endDate, pageNumber, limit);
      const json = await response.json();

      // console.log("JSON :: ", json)

      setStudents(json.students || []);
      setDatesList(json.dates || []);
      setValues(json.values || []);
      setTotalStudents(json.total_students || 0);
    } catch (error) {
      console.error("Error loading heatmap:", error);
    }
  };

  // Pagination Control
  const totalPages = Math.ceil(totalStudents / limit);

  const getColor = (value: number | null) => {
    if (value === null) return "bg-gray-200";
    if (value >= 80) return "bg-[#3B82F6]";
    if (value >= 60) return "bg-[#5BE12C]";
    if (value >= 40) return "bg-[#F5CD19]";
    return "bg-[#EA4228]";
  };

  // 📱 Small-Screen Warning
  if (isSmallScreen) {
    return (
      <div className="bg-yellow-50 border border-yellow-300 p-4 rounded-xl text-yellow-800 text-center shadow-md">
        <p className="font-semibold text-sm">Heatmap tidak dapat ditampilkan pada layar kecil.</p>
        <p className="text-xs mt-1">Silakan buka halaman ini menggunakan laptop atau tablet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-md border border-slate-100 w-full overflow-auto">
      <h2 className="text-lg font-semibold mb-4">
        Heatmap Kebahagiaan per Kelas (Page {page}/{totalPages})
      </h2>

      {/* ===================== TABLE GRID ====================== */}
      <div className="grid" style={{ gridTemplateColumns: `150px repeat(${datesList.length}, 1fr)` }}>

        {/* Header Dates */}
        <div className="font-semibold text-sm text-gray-700 border-b pb-2">Siswa</div>
        {datesList.map((d, i) => (
          <div key={i} className="text-xs text-gray-600 text-center border-b pb-2">{d}</div>
        ))}

        {/* Student Rows */}
        {students.map((student, i) => (
          <React.Fragment key={student}>
            <div className="text-sm font-medium py-2 border-b">{student}</div>

            {datesList.map((d, j) => {
              const value = values[i]?.[j] ?? null;

              return (
                <div
                  key={`${student}-${d}`}
                  className={`h-8 border-b border-r flex items-center justify-center text-[10px] font-semibold ${getColor(value)}`}
                >
                  {value !== null ? value : ""}
                </div>
              );
            })}

          </React.Fragment>
        ))}

      </div>

      {/* ===================== PAGINATION ====================== */}
      <div className="flex justify-center items-center gap-4 mt-4">
        <button
          disabled={page === 1}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-40"
          onClick={() => setPage((p) => p - 1)}
        >
          Prev
        </button>

        <span className="text-sm font-medium">
          Page {page} / {totalPages}
        </span>

        <button
          disabled={page >= totalPages}
          className="px-3 py-1 bg-gray-200 rounded disabled:opacity-40"
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
