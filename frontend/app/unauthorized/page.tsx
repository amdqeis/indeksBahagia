import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function UnauthorizedPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="mb-3 text-2xl font-bold">Akses Ditolak</h1>
      <p className="mb-6 text-sm text-slate-600">Anda tidak memiliki izin untuk membuka halaman ini.</p>
      <Link href="/">
        <Button>Kembali ke Home</Button>
      </Link>
    </section>
  )
}
