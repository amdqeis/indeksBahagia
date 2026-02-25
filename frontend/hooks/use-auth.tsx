"use client"

import type React from "react"

import { useState, useEffect, createContext, useContext } from "react"
import { useRouter } from "next/navigation"
import { authAPI } from "@/lib/api"

export type UserRole = "guest" | "user" | "guru" | "admin" | null

interface User {
  id: number
  fullname?: string
  email: string
  role: string
}

interface AuthContextType {
  user: User | null
  isLoggedIn: boolean
  isLoading: boolean
  role: UserRole
  login: (credentials: { username: string; password: string }) => Promise<{ success: boolean; role: UserRole }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [role, setRole] = useState<UserRole | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Check authentication status on mount
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await authAPI.checkAuth()
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
        setRole(data.user.role)
      }
    } catch (error) {
      console.error("Auth check failed:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (
    credentials: { username: string; password: string },
  ): Promise<{ success: boolean; role: UserRole }> => {
    try {
      const response = await authAPI.login({
        email: credentials.username,
        password: credentials.password,
      })
      const data = await response.json()

      if (response.ok) {
        setUser(data.user)
        setRole(data.user.role)
        return { success: true, role: data.user.role }
      } else {
        throw new Error(data.message || "Login failed")
      }
    } catch (error) {
      console.error("Login error:", error)
      return { success: false, role: null }
    }
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setUser(null)
      setRole(null)
      router.push("/")
    }
  }

  const value = {
    user,
    isLoggedIn: !!user,
    isLoading,
    role,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
