"use client";
import React, {useEffect, useState} from "react";
import { TrendingDown, Hand } from "lucide-react";
import { dataAPI } from "@/lib/api";

interface AlertCardProps {
  title: string;
  value: string | number;
  desc: string;
  icon: React.ReactNode;
}

interface AlertDashboardProps {
  kelas?: string;
  startDate: string;
  endDate: string;
}

interface AlertData {
  alert1: number;
  alert2: number;
  alert3: number;
}

function AlertCard({
  title, value, desc, icon
}: AlertCardProps) {
  return (
    <div className="bg-gradient-to-br from-rose-600 to-rose-700 p-4 rounded-xl shadow-md border border-rose-800 text-white w-full">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="text-sm text-rose-100">{title}</h3>
          <p className="text-3xl font-bold mt-1 text-white">{value}</p>
          <p className="text-xs text-rose-100 mt-2 leading-relaxed">{desc}</p>
        </div>
        <div className="text-rose-100 shrink-0">{icon}</div>
      </div>
    </div>
  );
}

export default function AlertSummary({
  kelas,
  startDate,
  endDate
}: AlertDashboardProps) {
  const [alertData, setAlertData] = useState<AlertData | null>(null);

  const fetchData = async () => {
    try {
        const alertResponse = await dataAPI.getAlerts(kelas || "", startDate, endDate);
        const Data = await alertResponse.json();
        if (!alertResponse.ok) throw new Error("getAlerts failed");
        setAlertData(Data);
  
      } catch (error) {
        console.error("Error fetching counter:", error);
      }
    };
  
  useEffect(() => {
    if (!kelas || !startDate || !endDate) return;
    fetchData();
  }, [kelas, startDate, endDate]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-3">

      {/* ALERT 1 — SHI rendah */}
    <AlertCard
      title="Alert 1 — SHI Rendah"
      value={alertData?.alert1 || 0}
      desc="Jumlah siswa dengan SHI < 40 minimal 3 kali pada rentang tanggal."
      icon={<TrendingDown size={24} />}
    />

    {/* ALERT 2 — Bullying */}
    <AlertCard
      title="Alert 2 — Bullying"
      value={alertData?.alert2 || 0}
      desc="Siswa merasa tidak aman atau ada laporan bullying dalam rentang tanggal."
      icon={<Hand size={24} />}
    />

    {/* ALERT 3 — Tren Menurun */}
    <AlertCard
      title="Alert 3 — Tren Menurun"
      value={alertData?.alert3 || 0}
      desc="Penurunan skor kebahagiaan signifikan dari awal ke akhir rentang."
      icon={<TrendingDown size={24} />}
    />

    </div>
  );
}
