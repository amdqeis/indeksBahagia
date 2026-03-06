"use client"

import { useState, useEffect, useMemo } from "react"
import { dataAPI } from "@/lib/api"
import RouteGuard from "@/components/route-guard"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import BarChartSHI from "@/components/ui/barchart"
import Top5TrenMenurun from "./tren-menurun"
import AlertSummary from "./alert-summary"
import HeatmapKebahagiaan from "./heatmap"
import { Download, ExternalLink, Loader2, ChevronLeft, ChevronRight } from "lucide-react"

interface ClassOption {
  label: string
  value: string
}

interface AccessClassResponse {
  label: string
  value: string
}

type PeriodMode = "range" | "month"

const formatDateLocal = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const formatMonthLocal = (d: Date) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

const resolveMonthRange = (monthValue: string) => {
  const [yearRaw, monthRaw] = monthValue.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)

  if (!year || !month || month < 1 || month > 12) {
    return null
  }

  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return {
    startDate: formatDateLocal(start),
    endDate: formatDateLocal(end),
  }
}

const shiftMonthValue = (monthValue: string, delta: number) => {
  const [yearRaw, monthRaw] = monthValue.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!year || !month || month < 1 || month > 12) {
    const fallback = new Date()
    fallback.setMonth(fallback.getMonth() + delta)
    return formatMonthLocal(fallback)
  }

  const current = new Date(year, month - 1, 1)
  current.setMonth(current.getMonth() + delta)
  return formatMonthLocal(current)
}

const getQuickRange = (days: number) => {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))
  return {
    startDate: formatDateLocal(start),
    endDate: formatDateLocal(end),
  }
}

function DashboardContent() {
  const spreadsheetUrl = "https://docs.google.com/spreadsheets/d/1yV8VJPtHpnXa-shfzgandugA0CRmaXinQMld2XC8rVQ/edit?gid=0#gid=0"
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])
  const [selectedClass, setSelectedClass] = useState("")
  const [periodMode, setPeriodMode] = useState<PeriodMode>("range")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [selectedStartDate, setSelectedStartDate] = useState("")
  const [selectedEndDate, setSelectedEndDate] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const quickRanges = useMemo(
    () => [
      { label: "7 Hari", value: 7 },
      { label: "14 Hari", value: 14 },
      { label: "30 Hari", value: 30 },
    ],
    [],
  )

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
    setSelectedStartDate(formatDateLocal(start))
    setSelectedEndDate(formatDateLocal(today))
    setSelectedMonth(formatMonthLocal(today))
    fetchClassOptions()
  }, [])

  const resolvedMonthRange = useMemo(() => resolveMonthRange(selectedMonth), [selectedMonth])
  const effectiveStartDate = periodMode === "month" ? (resolvedMonthRange?.startDate || "") : selectedStartDate
  const effectiveEndDate = periodMode === "month" ? (resolvedMonthRange?.endDate || "") : selectedEndDate

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

  const applyQuickRange = (days: number) => {
    const range = getQuickRange(days)
    setPeriodMode("range")
    setSelectedStartDate(range.startDate)
    setSelectedEndDate(range.endDate)
    setExportStatus(null)
  }

  const handleExport = async () => {
    if (!selectedClass || !effectiveStartDate || !effectiveEndDate) {
      setExportStatus({ type: "error", message: "Lengkapi kelas dan periode sebelum export." })
      return
    }

    setIsExporting(true)
    setExportStatus(null)

    try {
      const response = await dataAPI.exportSHIToSpreadsheet(selectedClass, effectiveStartDate, effectiveEndDate)
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.message || "Export gagal")
      }

      const worksheetInfo = json.worksheet ? ` ke worksheet ${json.worksheet}` : ""
      setExportStatus({
        type: "success",
        message: `Export berhasil (${json.exported_rows} baris data SHI${worksheetInfo}).`,
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
            <p className="text-sm text-slate-500">
              Pilih kelas dan periode analitik berdasarkan rentang tanggal atau bulan tertentu.
            </p>
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
              <label className="font-medium text-slate-700">Mode Periode</label>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setPeriodMode("range")
                    setExportStatus(null)
                  }}
                  className={`h-9 rounded-lg text-sm font-medium transition ${
                    periodMode === "range"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Rentang
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPeriodMode("month")
                    setExportStatus(null)
                  }}
                  className={`h-9 rounded-lg text-sm font-medium transition ${
                    periodMode === "month"
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Per Bulan
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            {periodMode === "range" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Periode Cepat:</span>
                  {quickRanges.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => applyQuickRange(item.value)}
                      className="h-8 rounded-full border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">Tanggal Mulai</label>
                    <input
                      type="date"
                      value={selectedStartDate}
                      max={selectedEndDate || undefined}
                      onChange={(e) => onChangeStartDate(e.target.value)}
                      className="h-11 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">Tanggal Akhir</label>
                    <input
                      type="date"
                      value={selectedEndDate}
                      min={selectedStartDate || undefined}
                      onChange={(e) => onChangeEndDate(e.target.value)}
                      className="h-11 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedMonth((prev) => shiftMonthValue(prev, -1))
                      setExportStatus(null)
                    }}
                    className="h-9"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Bulan Sebelumnya
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedMonth((prev) => shiftMonthValue(prev, 1))
                      setExportStatus(null)
                    }}
                    className="h-9"
                  >
                    Bulan Berikutnya
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="max-w-xs">
                  <label className="text-sm font-medium text-slate-700">Pilih Bulan</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(e.target.value)
                      setExportStatus(null)
                    }}
                    className="mt-2 h-11 w-full border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
            Periode aktif: {effectiveStartDate || "-"} s.d. {effectiveEndDate || "-"}
          </p>

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
                disabled={isExporting || !selectedClass || !effectiveStartDate || !effectiveEndDate}
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
            <BarChartSHI startDate={effectiveStartDate} endDate={effectiveEndDate} />
          </div>

          <div className="col-span-1">
            <AlertSummary kelas={selectedClass} startDate={effectiveStartDate} endDate={effectiveEndDate} />
            <Top5TrenMenurun kelas={selectedClass} startDate={effectiveStartDate} endDate={effectiveEndDate} />
          </div>
        </div>

        <HeatmapKebahagiaan kelas={selectedClass} startDate={effectiveStartDate} endDate={effectiveEndDate} />
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
