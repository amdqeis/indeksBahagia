import { redirect } from "next/navigation"

export default function AdminDashboardPage() {
  redirect("/admin/account-settings")
}
