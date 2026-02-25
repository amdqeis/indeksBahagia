"use client"

import { useEffect, useMemo, useState } from "react"
import RouteGuard from "@/components/route-guard"
import { adminAPI, type AdminAccount, type AdminClassOption } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle2, Upload, ArrowRightLeft, Table2, CircleAlert } from "lucide-react"

type FormState = {
  fullname: string
  email: string
  role: "admin" | "guru" | "user" | "guest"
  password: string
  kode: string
  kelas: string
}

const initialForm: FormState = {
  fullname: "",
  email: "",
  role: "user",
  password: "",
  kode: "",
  kelas: "",
}

type PopupState = {
  open: boolean
  title: string
  message: string
  variant: "success" | "error" | "info"
}

export default function AccountSettingsContent() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState<FormState>(initialForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([])
  const [sourceClass, setSourceClass] = useState("")
  const [targetClass, setTargetClass] = useState("")
  const [sourceStudents, setSourceStudents] = useState<AdminAccount[]>([])
  const [excludedStudentIds, setExcludedStudentIds] = useState<number[]>([])
  const [isClassLoading, setIsClassLoading] = useState(false)
  const [isMovingClass, setIsMovingClass] = useState(false)
  const [popup, setPopup] = useState<PopupState>({
    open: false,
    title: "",
    message: "",
    variant: "info",
  })

  const pageLabel = useMemo(() => `${page} / ${totalPages}`, [page, totalPages])
  const classSummaryLabel = useMemo(() => `${classOptions.length} kelas terdaftar`, [classOptions.length])

  const openPopup = (title: string, message: string, variant: PopupState["variant"]) => {
    setPopup({
      open: true,
      title,
      message,
      variant,
    })
  }

  const loadAccounts = async (targetPage = page) => {
    try {
      setError("")
      setNotice("")
      setIsLoading(true)

      const response = await adminAPI.getAccounts({
        page: targetPage,
        per_page: 10,
        search,
        role,
        sort_by: "created_at",
        sort_order: "desc",
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Gagal memuat daftar akun")
      }

      const normalizedAccounts = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.accounts)
          ? data.accounts
          : Array.isArray(data)
            ? data
            : []

      setAccounts(normalizedAccounts)
      setPage(Number(data?.current_page ?? data?.page ?? targetPage))
      setTotalPages(Math.max(1, Number(data?.pages ?? data?.total_pages ?? 1)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts(1)
    loadClassOptions()
  }, [])

  const loadClassOptions = async () => {
    try {
      setIsClassLoading(true)
      const response = await adminAPI.getClassOptions()
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Gagal memuat daftar kelas")
      }
      setClassOptions(Array.isArray(data?.data) ? data.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setIsClassLoading(false)
    }
  }

  const loadStudentsByClass = async (selectedSourceClass: string) => {
    if (!selectedSourceClass) {
      setSourceStudents([])
      setExcludedStudentIds([])
      return
    }

    try {
      setIsClassLoading(true)
      const response = await adminAPI.getStudentsByClass(selectedSourceClass)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Gagal memuat daftar siswa kelas")
      }
      setSourceStudents(Array.isArray(data?.data) ? data.data : [])
      setExcludedStudentIds([])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setIsClassLoading(false)
    }
  }

  const toggleExcludedStudent = (studentId: number) => {
    setExcludedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    )
  }

  const onMoveClass = async () => {
    if (!sourceClass || !targetClass) {
      setError("Kelas asal dan kelas tujuan wajib diisi")
      openPopup("Data Belum Lengkap", "Kelas asal dan kelas tujuan wajib diisi.", "error")
      return
    }

    try {
      setError("")
      setNotice("")
      setIsMovingClass(true)

      const response = await adminAPI.moveStudentsClass({
        source_class: sourceClass,
        target_class: targetClass,
        exclude_user_ids: excludedStudentIds,
      })
      const data = await response.json()
      if (!response.ok) {
        openPopup("Pindah Kelas Gagal", data.message || "Gagal memindahkan kelas siswa", "error")
        throw new Error(data.message || "Gagal memindahkan kelas siswa")
      }

      setNotice(
        `Pindah kelas berhasil. Dipindahkan: ${data.moved_count}, dikecualikan: ${data.excluded_count}, total kelas asal: ${data.total_source_students}.`,
      )
      openPopup(
        "Pindah Kelas Berhasil",
        `Dipindahkan ${data.moved_count} siswa, dikecualikan ${data.excluded_count} siswa.`,
        "success",
      )
      setSourceClass("")
      setTargetClass("")
      setSourceStudents([])
      setExcludedStudentIds([])
      await loadAccounts(1)
      await loadClassOptions()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setIsMovingClass(false)
    }
  }

  const resetForm = () => {
    setForm(initialForm)
    setEditingId(null)
  }

  const handleSubmit = async () => {
    try {
      setError("")
      setNotice("")
      if (!editingId) {
        setError("Tambah manual dinonaktifkan. Tambah akun hanya bisa melalui import CSV.")
        return
      }
      if (!form.fullname || !form.email || !form.role) {
        setError("Nama lengkap, email, dan role wajib diisi")
        return
      }

      const payload: {
        fullname: string
        email: string
        role: "admin" | "guru" | "user" | "guest"
        password?: string
        kode?: string
        kelas?: string
      } = {
        fullname: form.fullname,
        email: form.email,
        role: form.role,
        kode: form.kode || undefined,
        kelas: form.kelas || undefined,
      }

      if (form.password) {
        payload.password = form.password
      }

      const response = await adminAPI.updateAccount(editingId, payload)

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Gagal menyimpan akun")
      }

      setNotice(data.message || "Akun berhasil disimpan")
      resetForm()
      await loadAccounts(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    }
  }

  const onEdit = (account: AdminAccount) => {
    setEditingId(account.id)
    setForm({
      fullname: account.fullname,
      email: account.email,
      role: account.role,
      password: "",
      kode: account.kode ?? "",
      kelas: account.kelas ?? "",
    })
  }

  const onDelete = async (id: number) => {
    try {
      setError("")
      setNotice("")
      const response = await adminAPI.deleteAccount(id)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Gagal menghapus akun")
      }

      setNotice(data.message || "Akun berhasil dihapus")
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    }
  }

  const onImportCsv = async () => {
    if (!csvFile) {
      setError("Pilih file CSV terlebih dahulu")
      openPopup("File Belum Dipilih", "Pilih file CSV terlebih dahulu sebelum import.", "error")
      return
    }

    try {
      setError("")
      setNotice("")
      const response = await adminAPI.importAccountsCsv(csvFile)
      const data = await response.json()

      if (!response.ok) {
        openPopup("Import CSV Gagal", data.message || "Import CSV gagal", "error")
        throw new Error(data.message || "Import CSV gagal")
      }

      setNotice(`Import selesai: ${data.imported} berhasil, ${data.failed} gagal.`)
      openPopup("Import CSV Berhasil", `Berhasil ${data.imported}, gagal ${data.failed}.`, "success")
      setCsvFile(null)
      await loadAccounts(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    }
  }

  return (
    <RouteGuard requireAuth allowedRoles={["admin"]}>
      <section className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-r from-sky-100 via-cyan-50 to-emerald-100 p-6 shadow-sm">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-300/20 blur-2xl" />
          <div className="absolute -bottom-12 left-16 h-32 w-32 rounded-full bg-emerald-300/20 blur-2xl" />
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Account Settings</h1>
          <p className="mt-1 text-sm text-slate-700">
            Kelola akun dengan import CSV, pindah kelas massal, dan pembaruan data akun siswa.
          </p>
          <div className="mt-4 inline-flex rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700">
            {classSummaryLabel}
          </div>
        </div>

        {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{notice}</p> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-emerald-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Upload className="h-4 w-4 text-emerald-600" />
                Import CSV
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="max-w-md bg-white"
              />
              <Button onClick={onImportCsv} className="bg-emerald-600 text-white hover:bg-emerald-700">
                Import
              </Button>
            </CardContent>
            <CardContent className="pt-0">
              <p className="text-xs text-slate-500">Tambah akun hanya dari CSV. Format kolom: fullname,email,role,password,kode,kelas</p>
            </CardContent>
          </Card>

          <Card className="border-cyan-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <ArrowRightLeft className="h-4 w-4 text-cyan-600" />
                Pindah Kelas Massal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-500">
                Pindahkan seluruh siswa dari kelas asal ke kelas tujuan. Anda bisa mengecualikan siswa tertentu.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="source-class">Kelas Asal</Label>
                  <select
                    id="source-class"
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={sourceClass}
                    onChange={async (e) => {
                      const value = e.target.value
                      setSourceClass(value)
                      await loadStudentsByClass(value)
                    }}
                    disabled={isClassLoading || isMovingClass}
                  >
                    <option value="">Pilih kelas asal</option>
                    {classOptions.map((option) => (
                      <option key={option.kelas} value={option.kelas}>
                        {option.kelas} ({option.total_siswa} siswa)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target-class">Kelas Tujuan</Label>
                  <select
                    id="target-class"
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value)}
                    disabled={isMovingClass}
                  >
                    <option value="">Pilih kelas tujuan</option>
                    {classOptions.map((option) => (
                      <option key={`target-${option.kelas}`} value={option.kelas}>
                        {option.kelas}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-cyan-200 shadow-sm">
          <CardHeader>
            <CardTitle>Kecualikan Siswa (Opsional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sourceClass ? (
              <div className="max-h-56 overflow-y-auto rounded-xl border border-cyan-100 bg-cyan-50/30 p-3">
                {sourceStudents.length === 0 ? (
                  <p className="text-sm text-slate-500">Tidak ada siswa pada kelas ini.</p>
                ) : (
                  <div className="space-y-2">
                    {sourceStudents.map((student) => (
                      <label key={student.id} className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm">
                        <span>
                          {student.fullname} - {student.email}
                        </span>
                        <input
                          type="checkbox"
                          checked={excludedStudentIds.includes(student.id)}
                          onChange={() => toggleExcludedStudent(student.id)}
                          disabled={isMovingClass}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Pilih kelas asal untuk menampilkan daftar siswa.</p>
            )}

            <div className="flex gap-2">
              <Button
                onClick={onMoveClass}
                disabled={isMovingClass || isClassLoading || !sourceClass || !targetClass}
                className="bg-cyan-600 text-white hover:bg-cyan-700"
              >
                {isMovingClass ? "Memproses..." : "Pindahkan Kelas"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSourceClass("")
                  setTargetClass("")
                  setSourceStudents([])
                  setExcludedStudentIds([])
                }}
                disabled={isMovingClass}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {editingId ? (
          <Card className="border-amber-200 shadow-sm">
            <CardHeader>
              <CardTitle>Edit Akun</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullname">Nama Lengkap</Label>
                <Input id="fullname" value={form.fullname} onChange={(e) => setForm({ ...form, fullname: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as FormState["role"] })}
                >
                  <option value="admin">admin</option>
                  <option value="guru">guru</option>
                  <option value="user">user</option>
                  <option value="guest">guest</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password (opsional)</Label>
                <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kode">Kode</Label>
                <Input id="kode" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kelas">Kelas</Label>
                <select
                  id="kelas"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={form.kelas}
                  onChange={(e) => setForm({ ...form, kelas: e.target.value })}
                >
                  <option value="">Tanpa kelas</option>
                  {classOptions.map((option) => (
                    <option key={`edit-${option.kelas}`} value={option.kelas}>
                      {option.kelas}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-full flex gap-2">
                <Button onClick={handleSubmit}>Update</Button>
                <Button variant="outline" onClick={resetForm}>
                  Batal Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-slate-600" />
              Daftar Akun
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
              <Input
                placeholder="Cari nama/email/kode"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
              <select
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">Semua role</option>
                <option value="admin">admin</option>
                <option value="guru">guru</option>
                <option value="user">user</option>
                <option value="guest">guest</option>
              </select>
              <Button variant="outline" onClick={() => loadAccounts(1)} disabled={isLoading}>
                Cari
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-100 text-left">
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Kode</th>
                    <th className="px-3 py-2">Kelas</th>
                    <th className="px-3 py-2">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                        Tidak ada data
                      </td>
                    </tr>
                  ) : (
                    accounts.map((account) => (
                      <tr key={account.id} className="border-b">
                        <td className="px-3 py-2">{account.fullname}</td>
                        <td className="px-3 py-2">{account.email}</td>
                        <td className="px-3 py-2">{account.role}</td>
                        <td className="px-3 py-2">{account.kode ?? "-"}</td>
                        <td className="px-3 py-2">{account.kelas ?? "-"}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => onEdit(account)}>
                              Edit
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => onDelete(account.id)}>
                              Hapus
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button variant="outline" onClick={() => loadAccounts(page - 1)} disabled={page <= 1 || isLoading}>
                Prev
              </Button>
              <span className="text-sm text-slate-600">Halaman {pageLabel}</span>
              <Button variant="outline" onClick={() => loadAccounts(page + 1)} disabled={page >= totalPages || isLoading}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={popup.open} onOpenChange={(open) => setPopup((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {popup.variant === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : popup.variant === "error" ? (
                <CircleAlert className="h-5 w-5 text-red-600" />
              ) : (
                <CircleAlert className="h-5 w-5 text-sky-600" />
              )}
              {popup.title}
            </DialogTitle>
            <DialogDescription>{popup.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPopup((prev) => ({ ...prev, open: false }))}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RouteGuard>
  )
}
