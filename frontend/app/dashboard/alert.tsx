"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React, {useState, useEffect} from "react";
import { dataAPI } from "@/lib/api";


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

function AlertDashboard({
  kelas,
  startDate,
  endDate,
}: AlertDashboardProps) {
  
  const [alertData, setAlertData] = useState<AlertData | null>(null);

  const fetchData = async () => {
    try {
      if (!kelas || !startDate || !endDate) return;
      console.log(" X Kelas dan Date:", { kelas, startDate, endDate });
        const alertResponse = await dataAPI.getAlerts(kelas || "", startDate, endDate);
        const Data = await alertResponse.json();
        console.log("✅ Alert response:", Data);
  
        if (!alertResponse.ok) throw new Error("getAlerts failed");
        setAlertData(Data);
  
      } catch (error) {
        console.error("Error fetching counter:", error);
      }
    };
  
    // ✅ Panggil saat pertama kali halaman dibuka (atau direfresh)
    useEffect(() => {
      fetchData();
      const interval = setInterval(fetchData, 5000); // panggil ulang setiap 5 detik
      return () => clearInterval(interval); // bersihkan saat komponen unmount
    }, [kelas, startDate, endDate]);
  

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">Alert 1</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{alertData?.alert1 || 0}</div>
          <p className="text-xs text-muted-foreground">
            SHI_harian {"< 40"} tiga hari berturut-turut
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">Alert 2</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{alertData?.alert2 || 0}</div>
          <p className="text-xs text-muted-foreground">
            Siswa merasa tidak aman atau memiliki laporan bullying
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">Alert 3</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{alertData?.alert3 || 0}</div>
          <p className="text-xs text-muted-foreground">
            Tren SHI harian siswa menurun
          </p>
        </CardContent>
      </Card>

    </div>
  );
};

export default AlertDashboard;
