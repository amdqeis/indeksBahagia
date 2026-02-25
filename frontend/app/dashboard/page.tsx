"use client"

import { useState, useEffect } from "react"
import { dataAPI } from "@/lib/api"
import RouteGuard from "@/components/route-guard"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import BarChartSHI from "@/components/ui/barchart"
import Top5TrenMenurun from "./tren-menurun"
import AlertSummary from "./alert-summary"
import HeatmapKebahagiaan from "./heatmap"

interface ClassOption {
  label: string
  value: string
}

function DashboardContent() {
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [selectedClass, setSelectedClass] = useState("")
  const [selectedStartDate, setSelectedStartDate] = useState("")
  const [selectedEndDate, setSelectedEndDate] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const fetchClassOptions = async () => {
    try {
      setIsLoading(true)
      const res = await dataAPI.getAccessClass()
      const data = await res.json()
      const mapped = data.map((item: any) => ({
        label: item.label,
        value: item.value,
      }))

      setClassOptions(mapped)
      if (mapped.length > 0) {
        setSelectedClass(mapped[0].value)
      }
    } catch (error) {
      console.error("Error fetching class options:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 6)
    setSelectedStartDate(start.toISOString().split("T")[0])
    setSelectedEndDate(today.toISOString().split("T")[0])
    fetchClassOptions()
  }, [])

  const onChangeStartDate = (value: string) => {
    setSelectedStartDate(value)
    if (selectedEndDate && value > selectedEndDate) {
      setSelectedEndDate(value)
    }
  }

  const onChangeEndDate = (value: string) => {
    setSelectedEndDate(value)
    if (selectedStartDate && value < selectedStartDate) {
      setSelectedStartDate(value)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Memuat data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-sm shadow-sm p-5 md:p-6">
          <div className="flex flex-col gap-1 mb-4">
            <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Dashboard Analitik</h1>
            <p className="text-sm text-slate-500">Pilih kelas dan rentang tanggal untuk menampilkan data di antara kedua tanggal.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-slate-700">Kelas</label>
              <Select value={selectedClass} onValueChange={(value) => setSelectedClass(value)}>
                <SelectTrigger className="h-11 border-slate-300 focus:ring-slate-400">
                  <SelectValue placeholder={selectedClass || "Pilih kelas"} />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-medium text-slate-700">Tanggal Mulai</label>
              <input
                type="date"
                value={selectedStartDate}
                max={selectedEndDate || undefined}
                onChange={(e) => onChangeStartDate(e.target.value)}
                className="h-11 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-medium text-slate-700">Tanggal Akhir</label>
              <input
                type="date"
                value={selectedEndDate}
                min={selectedStartDate || undefined}
                onChange={(e) => onChangeEndDate(e.target.value)}
                className="h-11 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1">
            <BarChartSHI startDate={selectedStartDate} endDate={selectedEndDate} />
          </div>

          <div className="col-span-1">
            <AlertSummary kelas={selectedClass} startDate={selectedStartDate} endDate={selectedEndDate} />
            <Top5TrenMenurun kelas={selectedClass} startDate={selectedStartDate} endDate={selectedEndDate} />
          </div>
        </div>

        <HeatmapKebahagiaan kelas={selectedClass} startDate={selectedStartDate} endDate={selectedEndDate} />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <RouteGuard requireAuth={true} allowedRoles={["admin", "guru"]}>
      <DashboardContent />
    </RouteGuard>
  )
}
