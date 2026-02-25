"use client"

import { useEffect, useState } from "react"
import RouteGuard from "@/components/route-guard"
import { adminAPI, type AdminDashboardSummary } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const initialSummary: AdminDashboardSummary = {
  total_accounts: 0,
  total_admin: 0,
  total_guru: 0,
  total_siswa: 0,
  new_last_7_days: 0,
}

export default function AdminDashboardContent() {
  const [summary, setSummary] = useState<AdminDashboardSummary>(initialSummary)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  const loadSummary = async () => {
    try {
      setError("")
      setIsLoading(true)
      const response = await adminAPI.getDashboardSummary()
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Gagal memuat dashboard admin")
      }

      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  return (
    <RouteGuard requireAuth allowedRoles={["admin"]}>
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard Admin</h1>
            <p className="text-sm text-slate-600">Ringkasan akun dan aktivitas terbaru.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadSummary} disabled={isLoading}>
              Refresh
            </Button>
            <Link href="/admin/account-settings">
              <Button>Kelola Account Settings</Button>
            </Link>
          </div>
        </div>

        {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <SummaryCard title="Total Akun" value={summary.total_accounts} />
          <SummaryCard title="Admin" value={summary.total_admin} />
          <SummaryCard title="Guru" value={summary.total_guru} />
          <SummaryCard title="Siswa" value={summary.total_siswa} />
          <SummaryCard title="Akun Baru 7 Hari" value={summary.new_last_7_days} />
        </div>
      </section>
    </RouteGuard>
  )
}

function SummaryCard({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-600">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  )
}
