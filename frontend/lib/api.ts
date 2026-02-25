export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
export const dynamic = "force-dynamic"

export const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE_URL}${endpoint}`
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData

  const headers = new Headers(options.headers ?? undefined)
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const config: RequestInit = {
    ...options,
    credentials: "include",
    headers,
  }

  try {
    return await fetch(url, config)
  } catch (error) {
    console.error("API call failed:", error)
    throw error
  }
}

export const authAPI = {
  login: (credentials: { email: string; password: string }) =>
    apiCall("/api/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  logout: () =>
    apiCall("/api/logout", {
      method: "POST",
    }),

  checkAuth: () => apiCall("/api/check-auth"),

  validateToken: (token: string) =>
    apiCall(`/api/validate-token?token=${encodeURIComponent(token)}`, {
      method: "GET",
    }),

  forgotPassword: (email: string) =>
    apiCall("/api/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    apiCall("/api/reset-password", {
      method: "PUT",
      body: JSON.stringify({ token, password }),
    }),

  createAccount: (email: string) =>
    apiCall("/api/create-account", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetAccount: (token: string, password: string, username: string) =>
    apiCall("/api/reset-account", {
      method: "PUT",
      body: JSON.stringify({ token, password, username }),
    }),
}

export const dataAPI = {
  getSiswa: (page = 1, perPage = 10, filters: Record<string, string> = {}) => {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      ...filters,
    })
    return apiCall(`/api/siswa?${params.toString()}`)
  },

  getSiswaDashboard: (id: number) => apiCall(`/api/siswa/dashboard/${id}`),
  getSiswaFilterOptions: () => apiCall("/api/siswa/filters"),
  getSiswaTrendHarian: (userId: number) => apiCall(`/api/siswa/tren/harian/${userId}`),
  getSiswaTrendMingguan: (userId: number) => apiCall(`/api/siswa/tren/mingguan/${userId}`),

  addNote: (targetId: number, message: string) =>
    apiCall("/api/notes", {
      method: "POST",
      body: JSON.stringify({
        target_id: targetId,
        message,
      }),
    }),

  deleteSiswa: (id: number) =>
    apiCall(`/api/siswa/${id}`, {
      method: "DELETE",
    }),

  bulkDeleteSiswa: (ids: number[]) =>
    apiCall("/api/siswa/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  getAccessClass: () => apiCall("/api/access-classes"),

  submitSurveyHarian: (data: unknown) =>
    apiCall("/api/submit-form-harian", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  submitSurveyMingguan: (data: unknown) =>
    apiCall("/api/submit-form-mingguan", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getSurveyStatus: (type: "harian" | "mingguan") =>
    apiCall("/api/status-survey", {
      method: "POST",
      body: JSON.stringify({ type }),
    }),

  toggleSurveyAccess: (type: "harian" | "mingguan", action: "open" | "close") =>
    apiCall("/api/toggle-survey", {
      method: "POST",
      body: JSON.stringify({ type, action }),
    }),

  validInput: (type: "harian" | "mingguan") => apiCall(`/api/valid-input/${type}`),

  counterSubmit: (type: "harian" | "mingguan") =>
    apiCall("/api/counter-submit", {
      method: "POST",
      body: JSON.stringify({ type }),
    }),

  getSHIToday: (type: "harian" | "mingguan") =>
    apiCall("/api/shi-overall", {
      method: "POST",
      body: JSON.stringify({ type }),
    }),

  getOpenQuestion: (type: "harian" | "mingguan") =>
    apiCall("/api/word-cloud", {
      method: "POST",
      body: JSON.stringify({ type }),
    }),

  getAlerts: (kelas: string, startDate: string, endDate: string) =>
    apiCall("/api/get-alerts", {
      method: "POST",
      body: JSON.stringify({ kelas, start_date: startDate, end_date: endDate }),
    }),

  getHeatMap: (kelas: string, startDate: string, endDate: string, page = 1, limit = 20) =>
    apiCall("/api/heatmap", {
      method: "POST",
      body: JSON.stringify({ kelas, start_date: startDate, end_date: endDate, page, limit }),
    }),

  getTopLowTren: (kelas: string, startDate: string, endDate: string) =>
    apiCall("/api/get-top-low-tren", {
      method: "POST",
      body: JSON.stringify({ kelas, start_date: startDate, end_date: endDate }),
    }),

  getBarChart: (startDate: string, endDate: string) =>
    apiCall("/api/get-barchart", {
      method: "POST",
      body: JSON.stringify({ start_date: startDate, end_date: endDate }),
    }),

  getOverallTrendHarian: () => apiCall("/api/tren/overall/harian"),
  getOverallTrendMingguan: () => apiCall("/api/tren/overall/mingguan"),
}

export type AdminAccount = {
  id: number
  fullname: string
  email: string
  role: "admin" | "guru" | "user" | "guest"
  kode: string | null
  kelas: string | null
  created_at: string
  updated_at: string
}

export type AdminDashboardSummary = {
  total_accounts: number
  total_admin: number
  total_guru: number
  total_siswa: number
  new_last_7_days: number
}

export type AdminClassOption = {
  kelas: string
  total_siswa: number
}

export const adminAPI = {
  getDashboardSummary: () => apiCall("/api/admin/dashboard"),

  getAccounts: (params: {
    page?: number
    per_page?: number
    search?: string
    role?: string
    sort_by?: "created_at" | "updated_at" | "email" | "fullname" | "role"
    sort_order?: "asc" | "desc"
  }) => {
    const searchParams = new URLSearchParams()
    if (params.page) searchParams.set("page", String(params.page))
    if (params.per_page) searchParams.set("per_page", String(params.per_page))
    if (params.search) searchParams.set("search", params.search)
    if (params.role) searchParams.set("role", params.role)
    if (params.sort_by) searchParams.set("sort_by", params.sort_by)
    if (params.sort_order) searchParams.set("sort_order", params.sort_order)
    return apiCall(`/api/admin/accounts?${searchParams.toString()}`)
  },

  createAccount: (payload: {
    fullname: string
    email: string
    role: "admin" | "guru" | "user" | "guest"
    password: string
    kode?: string
    kelas?: string
  }) =>
    apiCall("/api/admin/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateAccount: (
    id: number,
    payload: {
      fullname?: string
      email?: string
      role?: "admin" | "guru" | "user" | "guest"
      password?: string
      kode?: string
      kelas?: string
    },
  ) =>
    apiCall(`/api/admin/accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteAccount: (id: number) =>
    apiCall(`/api/admin/accounts/${id}`, {
      method: "DELETE",
    }),

  importAccountsCsv: (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return apiCall("/api/admin/accounts/import-csv", {
      method: "POST",
      body: formData,
    })
  },

  getClassOptions: () => apiCall("/api/admin/classes"),

  getStudentsByClass: (sourceClass: string) =>
    apiCall(`/api/admin/classes/students?source_class=${encodeURIComponent(sourceClass)}`),

  moveStudentsClass: (payload: { source_class: string; target_class: string; exclude_user_ids: number[] }) =>
    apiCall("/api/admin/classes/move", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
}
