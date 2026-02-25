"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"

interface RouteGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  allowedRoles?: ("guest" | "user" | "guru" | "admin" | null)[]
  redirectTo?: string
}

export default function RouteGuard({ children, requireAuth = false, allowedRoles = ["user"], redirectTo = "/login" }: RouteGuardProps) {
  const { isLoggedIn, isLoading, role } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (requireAuth && !isLoggedIn) {
        router.push(redirectTo)
      } else if (!requireAuth && isLoggedIn && redirectTo === "/login") {
        // If user is logged in and trying to access login page, redirect to home
        router.push("/")
      }

      if (requireAuth && isLoggedIn && !allowedRoles.includes(role)) {
        router.push("/unauthorized") // arahkan ke halaman tidak punya akses
        return
      }
    }
  }, [isLoggedIn, isLoading, requireAuth, redirectTo, router, allowedRoles, role])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render children if auth requirements aren't met
  if (requireAuth && !isLoggedIn) {
    return null
  }

  // Don't render login page if user is already logged in
  if (!requireAuth && isLoggedIn && redirectTo === "/login") {
    return null
  }

  return <>{children}</>
}
