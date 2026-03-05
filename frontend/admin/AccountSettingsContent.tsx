"use client"

import { useEffect, useMemo, useState } from "react"
import RouteGuard from "@/components/route-guard"
import { adminAPI, type AdminAccount, type AdminClassOption } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { motion } from "framer-motion"
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

const CSV_MAX_SIZE_BYTES = 2 * 1024 * 1024
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([])
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [resetTargetAccount, setResetTargetAccount] = useState<AdminAccount | null>(null)
  const [resetPasswordValue, setResetPasswordValue] = useState("")
  const [resetConfirmPasswordValue, setResetConfirmPasswordValue] = useState("")
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [classOptions, setClassOptions] = useState<AdminClassOption[]>([])
  const [sourceClass, setSourceClass] = useState("")
  const [targetClass, setTargetClass] = useState("")
  const [sourceStudents, setSourceStudents] = useState<AdminAccount[]>([])
  const [excludedStudentIds, setExcludedStudentIds] = useState<number[]>([])
  const [isMoveConfirmOpen, setIsMoveConfirmOpen] = useState(false)
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
  const selectedCount = useMemo(() => selectedAccountIds.length, [selectedAccountIds])
  const isAllCurrentPageSelected = useMemo(() => {
    if (accounts.length === 0) return false
    return accounts.every((account) => selectedAccountIds.includes(account.id))
  }, [accounts, selectedAccountIds])

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
      setSelectedAccountIds((prev) => prev.filter((id) => normalizedAccounts.some((account) => account.id === id)))
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

  const toggleAccountSelection = (accountId: number) => {
    setSelectedAccountIds((prev) =>
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId],
    )
  }

  const toggleSelectAllCurrentPage = () => {
    const currentPageIds = accounts.map((account) => account.id)
    if (currentPageIds.length === 0) return

    setSelectedAccountIds((prev) => {
      const allSelected = currentPageIds.every((id) => prev.includes(id))
      if (allSelected) {
        return prev.filter((id) => !currentPageIds.includes(id))
      }

      const merged = new Set(prev)
      currentPageIds.forEach((id) => merged.add(id))
      return Array.from(merged)
    })
  }

  const onDownloadTemplateCsv = () => {
    const csvTemplate = [
      "fullname,email,role,password,kode,kelas",
      "Budi Santoso,budi.santoso@sekolah.id,user,Password123!,NIS001,10A",
      "Siti Rahma,siti.rahma@sekolah.id,guru,Password123!,NIP101,10A",
      "Admin Sekolah,admin@sekolah.id,admin,Password123!,,",
    ].join("\n")

    const blob = new Blob([`\uFEFF${csvTemplate}`], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = "template-upload-akun.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const validatePasswordInput = (password: string) => {
    if (password.length < 8) return "Password minimal 8 karakter."
    if (!/[A-Z]/.test(password)) return "Password harus mengandung minimal 1 huruf besar."
    if (!/[a-z]/.test(password)) return "Password harus mengandung minimal 1 huruf kecil."
    if (!/[0-9]/.test(password)) return "Password harus mengandung minimal 1 angka."
    return null
  }

  const openMoveConfirmation = () => {
    if (!sourceClass || !targetClass) {
      setError("Kelas asal dan kelas tujuan wajib diisi")
      openPopup("Data Belum Lengkap", "Kelas asal dan kelas tujuan wajib diisi.", "error")
      return
    }
    if (sourceClass === targetClass) {
      setError("Kelas asal dan kelas tujuan tidak boleh sama")
      openPopup("Kelas Tidak Valid", "Kelas asal dan kelas tujuan tidak boleh sama.", "error")
      return
    }

    setError("")
    setNotice("")
    setIsMoveConfirmOpen(true)
  }

  const onMoveClass = async () => {
    if (!sourceClass || !targetClass) {
      setError("Kelas asal dan kelas tujuan wajib diisi")
      openPopup("Data Belum Lengkap", "Kelas asal dan kelas tujuan wajib diisi.", "error")
      return
    }
    if (sourceClass === targetClass) {
      setError("Kelas asal dan kelas tujuan tidak boleh sama")
      openPopup("Kelas Tidak Valid", "Kelas asal dan kelas tujuan tidak boleh sama.", "error")
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
      setIsMoveConfirmOpen(false)
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

  const closeEditDialog = () => {
    setIsEditDialogOpen(false)
    resetForm()
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
      if (!EMAIL_REGEX.test(form.email)) {
        setError("Format email tidak valid")
        return
      }
      if ((form.role === "user" || form.role === "guru") && !form.kelas) {
        setError("Kelas wajib diisi untuk role user/guru")
        return
      }
      if ((form.role === "admin" || form.role === "guest") && form.kelas) {
        setError("Kelas hanya boleh diisi untuk role user/guru")
        return
      }
      if (form.password) {
        const passwordValidationError = validatePasswordInput(form.password)
        if (passwordValidationError) {
          setError(passwordValidationError)
          return
        }
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
      closeEditDialog()
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
    setIsEditDialogOpen(true)
  }

  const onDelete = async (id: number) => {
    if (!window.confirm("Yakin ingin menghapus akun ini?")) return

    try {
      setError("")
      setNotice("")
      const response = await adminAPI.deleteAccount(id)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || "Gagal menghapus akun")
      }

      setNotice(data.message || "Akun berhasil dihapus")
      setSelectedAccountIds((prev) => prev.filter((selectedId) => selectedId !== id))
      await loadAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    }
  }

  const openResetDialog = (account: AdminAccount) => {
    setResetTargetAccount(account)
    setResetPasswordValue("")
    setResetConfirmPasswordValue("")
    setIsResetDialogOpen(true)
  }

  const onResetPassword = async () => {
    if (!resetTargetAccount) return
    if (!resetPasswordValue) {
      setError("Password baru wajib diisi")
      return
    }

    const passwordValidationError = validatePasswordInput(resetPasswordValue)
    if (passwordValidationError) {
      setError(passwordValidationError)
      return
    }

    if (resetPasswordValue !== resetConfirmPasswordValue) {
      setError("Konfirmasi password tidak cocok")
      return
    }

    try {
      setError("")
      setNotice("")
      setIsResettingPassword(true)

      const response = await adminAPI.resetAccountPassword(resetTargetAccount.id, resetPasswordValue)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Gagal reset password")
      }

      setNotice(data.message || "Password berhasil direset")
      openPopup(
        "Reset Password Berhasil",
        `Akun: ${resetTargetAccount.fullname}\nPassword baru berhasil disimpan.`,
        "success",
      )
      setIsResetDialogOpen(false)
      setResetTargetAccount(null)
      setResetPasswordValue("")
      setResetConfirmPasswordValue("")
      await loadAccounts(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setIsResettingPassword(false)
    }
  }

  const openBulkDeleteDialog = () => {
    if (selectedAccountIds.length === 0) {
      setError("Pilih minimal satu akun untuk dihapus")
      openPopup("Belum Ada Pilihan", "Pilih minimal satu akun terlebih dahulu.", "error")
      return
    }
    setIsBulkDeleteDialogOpen(true)
  }

  const onBulkDelete = async () => {
    if (selectedAccountIds.length === 0) return

    try {
      setError("")
      setNotice("")
      setIsBulkDeleting(true)

      const response = await adminAPI.bulkDeleteAccounts(selectedAccountIds)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Gagal menghapus akun terpilih")
      }

      setNotice(data.message || "Akun terpilih berhasil dihapus")
      openPopup("Hapus Batch Berhasil", `${data.deleted_count ?? selectedAccountIds.length} akun berhasil dihapus.`, "success")
      setIsBulkDeleteDialogOpen(false)
      setSelectedAccountIds([])
      await loadAccounts(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan")
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const onImportCsv = async () => {
    if (!csvFile) {
      setError("Pilih file CSV terlebih dahulu")
      openPopup("File Belum Dipilih", "Pilih file CSV terlebih dahulu sebelum import.", "error")
      return
    }
    if (!csvFile.name.toLowerCase().endsWith(".csv")) {
      setError("Format file harus .csv")
      openPopup("Format File Tidak Valid", "Unggah file dengan ekstensi .csv", "error")
      return
    }
    if (csvFile.size > CSV_MAX_SIZE_BYTES) {
      setError("Ukuran file maksimal 2 MB")
      openPopup("Ukuran File Terlalu Besar", "Ukuran file CSV maksimal 2 MB.", "error")
      return
    }

    try {
      setError("")
      setNotice("")
      const response = await adminAPI.importAccountsCsv(csvFile)
      const data = await response.json()

      if (!response.ok) {
        const backendErrors = Array.isArray(data?.errors)
          ? data.errors
              .slice(0, 5)
              .map((item: { row?: number; message?: string }) => `Baris ${item.row ?? "-"}: ${item.message ?? "Tidak valid"}`)
          : []
        const detailMessage = backendErrors.length > 0 ? `${data.message || "Import CSV gagal"}\n${backendErrors.join("\n")}` : data.message || "Import CSV gagal"
        openPopup("Import CSV Gagal", detailMessage, "error")
        throw new Error(data.message || "Import CSV gagal")
      }

      setNotice(`Import selesai: ${data.imported} berhasil, ${data.failed} gagal.`)
      if (Array.isArray(data?.errors) && data.errors.length > 0) {
        const previewErrors = data.errors
          .slice(0, 5)
          .map((item: { row?: number; message?: string }) => `Baris ${item.row ?? "-"}: ${item.message ?? "Tidak valid"}`)
          .join("\n")
        openPopup(
          "Import CSV Selesai dengan Validasi",
          `Berhasil ${data.imported}, gagal ${data.failed}.\n${previewErrors}`,
          "info",
        )
      } else {
        openPopup("Import CSV Berhasil", `Berhasil ${data.imported}, gagal ${data.failed}.`, "success")
      }
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
              <Button variant="outline" onClick={onDownloadTemplateCsv}>
                Download Template CSV
              </Button>
            </CardContent>
            <CardContent className="pt-0">
              <p className="text-xs text-slate-500">
                Tambah akun hanya dari CSV. Format kolom: fullname,email,role,password,kode,kelas. Password minimal 8 karakter
                (huruf besar, huruf kecil, angka). Role user/guru wajib isi kelas.
              </p>
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
                Pindahkan seluruh siswa dari kelas asal ke kelas tujuan. Pengecualian siswa diatur pada popup konfirmasi.
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

              <div className="flex gap-2">
                <Button
                  onClick={openMoveConfirmation}
                  disabled={isMovingClass || isClassLoading || !sourceClass || !targetClass}
                  className="bg-cyan-600 text-white hover:bg-cyan-700"
                >
                  Lanjut Konfirmasi
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
        </div>

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
              <Button
                variant="destructive"
                onClick={openBulkDeleteDialog}
                disabled={selectedCount === 0 || isLoading || isBulkDeleting}
              >
                Hapus Terpilih ({selectedCount})
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-100 text-left">
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isAllCurrentPageSelected}
                        onChange={toggleSelectAllCurrentPage}
                        disabled={accounts.length === 0 || isLoading}
                        aria-label="Pilih semua akun pada halaman ini"
                      />
                    </th>
                    <th className="px-3 py-2">Nama Akun</th>
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
                      <td className="px-3 py-4 text-center text-slate-500" colSpan={7}>
                        Tidak ada data
                      </td>
                    </tr>
                  ) : (
                    accounts.map((account) => (
                      <tr key={account.id} className="border-b">
                        <td className="px-3 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={selectedAccountIds.includes(account.id)}
                            onChange={() => toggleAccountSelection(account.id)}
                            aria-label={`Pilih akun ${account.fullname}`}
                            disabled={isLoading || isBulkDeleting}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col gap-2">
                            <span className="font-medium text-slate-900">{account.fullname}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-fit border-amber-300 text-amber-700 hover:bg-amber-50"
                              onClick={() => openResetDialog(account)}
                              disabled={isResettingPassword || isBulkDeleting}
                            >
                              Reset Password
                            </Button>
                          </div>
                        </td>
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

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeEditDialog()
            return
          }
          setIsEditDialogOpen(true)
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Akun</DialogTitle>
            <DialogDescription>Perbarui data akun pengguna, lalu simpan perubahan.</DialogDescription>
          </DialogHeader>
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="grid gap-3 md:grid-cols-2"
          >
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.2 }} className="space-y-2">
              <Label htmlFor="edit-fullname">Nama Lengkap</Label>
              <Input id="edit-fullname" value={form.fullname} onChange={(e) => setForm({ ...form, fullname: e.target.value })} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.2 }} className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.2 }} className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <select
                id="edit-role"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as FormState["role"] })}
              >
                <option value="admin">admin</option>
                <option value="guru">guru</option>
                <option value="user">user</option>
                <option value="guest">guest</option>
              </select>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.2 }} className="space-y-2">
              <Label htmlFor="edit-password">Password (opsional)</Label>
              <Input id="edit-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.2 }} className="space-y-2">
              <Label htmlFor="edit-kode">Kode</Label>
              <Input id="edit-kode" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24, duration: 0.2 }} className="space-y-2">
              <Label htmlFor="edit-kelas">Kelas</Label>
              <select
                id="edit-kelas"
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
            </motion.div>
          </motion.div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={!editingId}>
              Update
            </Button>
            <Button variant="outline" onClick={closeEditDialog}>
              Batal Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMoveConfirmOpen} onOpenChange={setIsMoveConfirmOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Konfirmasi Pindah Kelas Massal</DialogTitle>
            <DialogDescription>
              Pilih siswa yang ingin dikecualikan sebelum proses pindah kelas dijalankan.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-cyan-100 bg-cyan-50/30 p-4 text-sm">
            <p>
              <span className="font-semibold text-slate-800">Kelas asal:</span> {sourceClass || "-"}
            </p>
            <p>
              <span className="font-semibold text-slate-800">Kelas tujuan:</span> {targetClass || "-"}
            </p>
            <p>
              <span className="font-semibold text-slate-800">Total siswa kelas asal:</span> {sourceStudents.length}
            </p>
            <p>
              <span className="font-semibold text-slate-800">Dikecualikan:</span> {excludedStudentIds.length}
            </p>
          </div>

          {isClassLoading ? (
            <p className="text-sm text-slate-500">Memuat daftar siswa...</p>
          ) : !sourceClass ? (
            <p className="text-sm text-slate-500">Pilih kelas asal untuk melihat daftar siswa.</p>
          ) : sourceStudents.length === 0 ? (
            <p className="text-sm text-slate-500">Tidak ada siswa pada kelas asal ini.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-cyan-100 bg-white p-3">
              <div className="space-y-2">
                {sourceStudents.map((student) => (
                  <label key={student.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
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
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveConfirmOpen(false)} disabled={isMovingClass}>
              Batal
            </Button>
            <Button
              onClick={onMoveClass}
              disabled={isMovingClass || isClassLoading || !sourceClass || !targetClass}
              className="bg-cyan-600 text-white hover:bg-cyan-700"
            >
              {isMovingClass ? "Memproses..." : "Konfirmasi Pindah Kelas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isResetDialogOpen}
        onOpenChange={(open) => {
          setIsResetDialogOpen(open)
          if (!open) {
            setResetTargetAccount(null)
            setResetPasswordValue("")
            setResetConfirmPasswordValue("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Reset Password</DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {resetTargetAccount
                ? `Akun: ${resetTargetAccount.fullname}\nEmail: ${resetTargetAccount.email}\n\nLanjut reset password akun ini?`
                : "Pilih akun yang akan direset password-nya."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="reset-password">Password Baru</Label>
              <Input
                id="reset-password"
                type="password"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="Masukkan password baru"
                disabled={isResettingPassword}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm-password">Konfirmasi Password Baru</Label>
              <Input
                id="reset-confirm-password"
                type="password"
                value={resetConfirmPasswordValue}
                onChange={(e) => setResetConfirmPasswordValue(e.target.value)}
                placeholder="Ulangi password baru"
                disabled={isResettingPassword}
              />
            </div>
            <p className="text-xs text-slate-500">Password minimal 8 karakter, berisi huruf besar, huruf kecil, dan angka.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsResetDialogOpen(false)
                setResetTargetAccount(null)
                setResetPasswordValue("")
                setResetConfirmPasswordValue("")
              }}
              disabled={isResettingPassword}
            >
              Batal
            </Button>
            <Button variant="destructive" onClick={onResetPassword} disabled={!resetTargetAccount || isResettingPassword}>
              {isResettingPassword ? "Memproses..." : "Ya, Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Konfirmasi Hapus Batch</DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {`Anda akan menghapus ${selectedCount} akun terpilih.\nTindakan ini tidak dapat dibatalkan.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkDeleteDialogOpen(false)} disabled={isBulkDeleting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={onBulkDelete} disabled={isBulkDeleting || selectedCount === 0}>
              {isBulkDeleting ? "Menghapus..." : "Ya, Hapus Terpilih"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <DialogDescription className="whitespace-pre-line">{popup.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPopup((prev) => ({ ...prev, open: false }))}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RouteGuard>
  )
}
