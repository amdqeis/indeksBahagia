"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"

export default function HomePage() {
  const { user } = useAuth()

  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <Image
        src="/Gedung SMP.png"
        alt="Gedung SMP"
        fill
        priority
        className="object-cover object-center"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-black/50" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/30" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col justify-end px-6 pb-8 pt-10 sm:px-8 sm:pb-10 md:px-10 md:pb-12 lg:px-12 lg:pb-14">
        <div className="flex w-full items-end justify-between gap-6">
          <div className="max-w-3xl">
            <h1 className="font-serif text-5xl font-semibold leading-[0.9] text-white drop-shadow-xl sm:text-6xl md:text-7xl lg:text-8xl">
              Indeks
              <br />
              Bahagia
            </h1>

            <p className="mt-4 max-w-xl text-sm text-white/90 sm:text-base md:text-lg">
              Platform pemantauan kebahagiaan sekolah.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {(user?.role === "admin" || user?.role === "guru") && (
                <Link href="/dashboard">
                  <Button className="bg-orange-500 text-white hover:bg-orange-600">Lihat Analisis</Button>
                </Link>
              )}

              <Link href={user?.role === "user" ? "/survey" : "/survey-control"}>
                <Button variant="secondary" className="bg-white/90 text-slate-900 hover:bg-white">
                  Buka Survey
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
