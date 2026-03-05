"use client"

import { useState, useEffect } from "react"
import { dataAPI } from "@/lib/api"
import RouteGuard from "@/components/route-guard"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import BarChartSHI from "@/components/ui/barchart"
import Top5TrenMenurun from "./tren-menurun"
import AlertSummary from "./alert-summary"
import HeatmapKebahagiaan from "./heatmap"
import { Download, ExternalLink, Loader2 } from "lucide-react"

interface ClassOption {
  label: string
  value: string
}

interface AccessClassResponse {
  label: string
  value: string
}

function DashboardContent() {
  const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/1yV8VJPtHpnXa-shfzgandugA0CRmaXinQMld2XC8rVQ/edit?gid=0#gid=0"
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [selectedClass, setSelectedClass] = useState("")
  const [selectedStartDate, setSelectedStartDate] = useState("")
  const [selectedEndDate, setSelectedEndDate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const fetchClassOptions = async () => {
    try {
      setIsLoading(true)
      const res = await dataAPI.getAccessClass()
      const data: AccessClassResponse[] = await res.json()
      const mapped = data.map((item) => ({
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
    setExportStatus(null)
    setSelectedStartDate(value)
    if (selectedEndDate && value > selectedEndDate) {
      setSelectedEndDate(value)
    }
  }

  const onChangeEndDate = (value: string) => {
    setExportStatus(null)
    setSelectedEndDate(value)
    if (selectedStartDate && value < selectedStartDate) {
      setSelectedStartDate(value)
    }
  }

  const handleExport = async () => {
    if (!selectedClass || !selectedStartDate || !selectedEndDate) {
      setExportStatus({ type: "error", message: "Lengkapi kelas dan rentang tanggal sebelum export." })
      return
    }

    setIsExporting(true)
    setExportStatus(null)

    try {
      const response = await dataAPI.exportSHIToSpreadsheet(selectedClass, selectedStartDate, selectedEndDate)
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.message || "Export gagal")
      }

      setExportStatus({
        type: "success",
        message: `Export berhasil (${json.exported_rows} baris data SHI).`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan saat export."
      setExportStatus({ type: "error", message })
    } finally {
      setIsExporting(false)
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
              <Select
                value={selectedClass}
                onValueChange={(value) => {
                  setSelectedClass(value)
                  setExportStatus(null)
                }}
              >
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

          <div className="mt-5 rounded-xl border border-sky-100 bg-gradient-to-r from-sky-50 via-cyan-50 to-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Export SHI per Siswa</p>
                <p className="text-xs text-slate-600 mt-1">
                  Data akan dikirim ke Google Spreadsheet.
                  {" "}
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-sky-700 hover:text-sky-800"
                  >
                    Buka Spreadsheet <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </p>
              </div>

              <Button
                type="button"
                onClick={handleExport}
                disabled={isExporting || !selectedClass || !selectedStartDate || !selectedEndDate}
                className="h-11 rounded-xl px-5 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 text-white shadow-sm hover:from-cyan-500 hover:via-sky-500 hover:to-blue-500"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isExporting ? "Mengirim..." : "Export ke Spreadsheet"}
              </Button>
            </div>

            {exportStatus && (
              <div
                className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
                  exportStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {exportStatus.message}
              </div>
            )}
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
