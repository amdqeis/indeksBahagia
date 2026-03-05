"use client"

import { CardHeader, CardContent, Card, CardTitle } from "@/components/ui/card"
import HappinessGauge from "@/components/gauge-chart"
import InfoCard from "@/components/info-card"
import { useEffect, useState } from "react"
import { dataAPI } from "@/lib/api"

interface CounterProps {
  count?: number
  shi?: number
}

const gaugeBands = [
  { label: "Merah (<40%)", note: "Risiko tinggi", className: "text-red-500" },
  { label: "Kuning (40%-59%)", note: "Perlu perhatian", className: "text-yellow-500" },
  { label: "Hijau (60%-79%)", note: "Baik", className: "text-green-600" },
  { label: "Biru (80%-100%)", note: "Sangat baik", className: "text-blue-600" },
]

export default function SurveyMingguanResponse() {
  const [counter, setCounter] = useState<CounterProps>({ count: undefined })

  const fetchCounter = async () => {
    try {
      const [shiResponse, counterResponse] = await Promise.all([
        dataAPI.getSHIToday("mingguan"),
        dataAPI.counterSubmit("mingguan"),
      ])

      const [shiData, counterData] = await Promise.all([shiResponse.json(), counterResponse.json()])

      if (!shiResponse.ok) throw new Error("getSHIToday failed")
      if (!counterResponse.ok) throw new Error("counterSubmit failed")

      setCounter({ shi: shiData.shi, count: counterData.count })
    } catch (error) {
      console.error("Error fetching counter:", error)
    }
  }

  useEffect(() => {
    fetchCounter()
    const interval = setInterval(fetchCounter, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Rata-rata Indeks Kebahagiaan Mingguan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center">
          <div className="mx-auto w-full max-w-[460px] rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <HappinessGauge value={counter.shi ?? 0} label="SHI Today" size={250} />
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700">Interpretasi Warna Gauge</h3>
            <div className="space-y-2">
              {gaugeBands.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span className={`text-sm font-semibold ${item.className}`}>{item.label}</span>
                  <span className="text-sm text-slate-600">{item.note}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Total Siswa Mengisi Survey</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[280px] items-center justify-center">
          <InfoCard value={counter.count ?? 0} label="Siswa" color="#008000" size="lg" />
        </CardContent>
      </Card>
    </div>
  )
}
