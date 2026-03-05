"use client"

import { useState, type ComponentType } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Home, BarChart3, LogIn, LogOut, User, Menu, X, ListCheckIcon, ListOrderedIcon, Settings } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

type NavItem = {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
  requireAuth?: boolean
  requireRole?: string[] | string
}

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3, requireAuth: true, requireRole: ["admin", "guru"] },
  { href: "/admin/account-settings", label: "Account Settings", icon: Settings, requireAuth: true, requireRole: ["admin"] },
  { href: "/survey-control", label: "Survey", icon: ListCheckIcon, requireAuth: true, requireRole: ["admin", "guru"] },
  { href: "/survey", label: "Survey", icon: ListCheckIcon, requireAuth: true, requireRole: ["user"] },
  { href: "/data-siswa", label: "Lihat Data", icon: ListOrderedIcon, requireAuth: true, requireRole: ["admin", "guru"] },
] as NavItem[]

export default function Navbar() {
  const { isLoggedIn, role, user, logout } = useAuth()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isActive = (href: string) => pathname === href

  const hasAccess = (item: NavItem) => {
    if (!item.requireAuth) return true

    if (item.requireAuth && !isLoggedIn) return false

    if (!item.requireRole) return true

    if (typeof item.requireRole === "string") {
      return role === item.requireRole
    }

    if (Array.isArray(item.requireRole)) {
      if (!role) return false
      return item.requireRole.includes(role)
    }

    return false
  }

  const desktopNavItems = navItems.filter(hasAccess)

  return (
    <motion.nav className="border-b bg-white shadow-lg" initial={false} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0 }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <motion.div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600" whileHover={{ rotate: 6, scale: 1.05 }}>
                <img src="/logo.png" alt="Logo APK" />
              </motion.div>
              <motion.span className="ml-2 text-xl font-bold text-gray-900">HappinessIndex</motion.span>
            </Link>
          </div>

          <motion.div className="hidden md:flex items-center space-x-4">
            {desktopNavItems.map((item) => (
              <motion.div key={item.href} whileHover={{ y: -1 }}>
                <Link
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-blue-100 text-blue-700"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Link>
              </motion.div>
            ))}

            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    {user?.email}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={logout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button className="flex items-center">
                  <LogIn className="h-4 w-4 mr-2" />
                  Login
                </Button>
              </Link>
            )}
          </motion.div>

          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen ? (
            <motion.div
              className="md:hidden"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              <motion.div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t">
                {navItems.map((item) => {
                  if (!hasAccess(item)) return null

                  return (
                    <motion.div key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors ${
                          isActive(item.href)
                            ? "bg-blue-100 text-blue-700"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        }`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <item.icon className="h-5 w-5 mr-3" />
                        {item.label}
                      </Link>
                    </motion.div>
                  )
                })}

                {isLoggedIn ? (
                  <div className="border-t pt-4">
                    <div className="flex items-center px-3 py-2 text-base font-medium text-gray-600">
                      <User className="h-5 w-5 mr-3" />
                      {user?.email}
                    </div>
                    <button
                      onClick={logout}
                      className="flex items-center w-full px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                    >
                      <LogOut className="h-5 w-5 mr-3" />
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="border-t pt-4">
                    <Link
                      href="/login"
                      className="flex items-center px-3 py-2 text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <LogIn className="h-5 w-5 mr-3" />
                      Login
                    </Link>
                  </div>
                )}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.nav>
  )
}
