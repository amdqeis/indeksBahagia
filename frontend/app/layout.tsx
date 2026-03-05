import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Navbar from "@/components/navbar"
import { AuthProvider } from "@/hooks/use-auth"
import PageTransition from "@/components/page-transition"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Survey Arrafi",
  description: "Platform digital untuk pemantauan tingkat kebahagiaan di sekolah Arrafi",
  icons:{
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <AuthProvider>
          <Navbar />
          <main className="relative overflow-x-clip">
            <PageTransition>{children}</PageTransition>
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}
