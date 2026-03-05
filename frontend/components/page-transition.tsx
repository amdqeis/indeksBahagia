"use client"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

type PageTransitionProps = {
  children: ReactNode
}

type VariantShape = {
  initial: { opacity: number; y?: number; x?: number; scale?: number; filter?: string }
  animate: { opacity: number; y?: number; x?: number; scale?: number; filter?: string }
  exit: { opacity: number; y?: number; x?: number; scale?: number; filter?: string }
  transition: { duration: number; ease: "easeInOut" | "easeOut" | "easeIn" }
}

const routeVariants: VariantShape[] = [
  {
    initial: { opacity: 0, y: 16, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -12, filter: "blur(4px)" },
    transition: { duration: 0.32, ease: "easeOut" },
  },
  {
    initial: { opacity: 0, x: 18 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -18 },
    transition: { duration: 0.28, ease: "easeInOut" },
  },
  {
    initial: { opacity: 0, scale: 0.985 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.01 },
    transition: { duration: 0.3, ease: "easeOut" },
  },
]

function pickVariant(pathname: string): VariantShape {
  const depth = pathname.split("/").filter(Boolean).length
  return routeVariants[depth % routeVariants.length]
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const selected = pickVariant(pathname)

  if (reduceMotion) {
    return <div>{children}</div>
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={selected.initial}
        animate={selected.animate}
        exit={selected.exit}
        transition={selected.transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
