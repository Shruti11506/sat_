"use client"

import * as React from "react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion"
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function Github(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

/* =============================================================================
 * GitHubSky
 *
 * A dark glass card with an interactive night sky. One real star hides among
 * hundreds of dim twinkles. Discovering it reveals a calm star-on-GitHub CTA.
 * ============================================================================= */

export interface GitHubSkyProps extends Omit<
  React.ComponentPropsWithoutRef<"div">,
  "children"
> {
  href?: string
  headline?: string
  description?: string
  buttonLabel?: string
  hint?: string
  starCount?: number
  seed?: number
  initiallyRevealed?: boolean
  onStar?: () => void
  openInNewTab?: boolean
}

type StarData = {
  id: number
  x: number
  y: number
  size: number
  baseOpacity: number
  twinkleSpeed: number
  twinklePhase: number
  isReal: boolean
}

type Phase = "idle" | "near" | "discovered" | "starring" | "done"

type FlightState = {
  fromX: number
  fromY: number
  toX: number
  toY: number
}

type PointerState = {
  x: number
  y: number
  inside: boolean
}

type RippleState = {
  active: boolean
  t: number
  x: number
  y: number
}

type CardSize = {
  width: number
  height: number
}

type StarField = {
  stars: StarData[]
  realStar: StarData
}

const STAR_COUNT_MIN = 150
const STAR_COUNT_MAX = 400
const STAR_COUNT_DEFAULT = 280

const NEAR_RADIUS = 0.14
const HOVER_RADIUS = 0.028
const PARALLAX_RADIUS = 0.22
const PARALLAX_STRENGTH = 4.5
const NEAR_DIM_RADIUS = 0.2
const RIPPLE_DURATION = 1.4
const FLIGHT_MS = 1000

const EASE_OUT: Transition = {
  duration: 0.7,
  ease: [0.16, 1, 0.3, 1],
}

const CONTENT_EASE: Transition = {
  duration: 0.85,
  ease: [0.16, 1, 0.3, 1],
}

const STAR_FLIGHT: Transition = {
  duration: 0.95,
  ease: [0.22, 1, 0.36, 1],
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function generateStars(count: number, seed: number): StarField {
  const rand = mulberry32(seed)
  const stars: StarData[] = []
  const realIndex = Math.floor(rand() * count)
  let realStar: StarData | undefined

  for (let i = 0; i < count; i++) {
    const isReal = i === realIndex
    const margin = isReal ? 0.18 : 0.02
    const starType = rand()

    let size = 1.6 + rand() * 1.8 // 1.6px - 3.4px
    let baseOpacity = 0.5 + rand() * 0.45 // 0.5 - 0.95

    // Prominent beacons and constellations
    if (starType > 0.88) {
      size = 3.6 + rand() * 2.2 // 3.6px - 5.8px
      baseOpacity = 0.9 + rand() * 0.1
    } else if (starType > 0.65) {
      size = 2.4 + rand() * 1.4
      baseOpacity = 0.7 + rand() * 0.28
    }

    const star: StarData = {
      id: i,
      x: margin + rand() * (1 - margin * 2),
      y: margin + rand() * (1 - margin * 2),
      size,
      baseOpacity,
      twinkleSpeed: 0.4 + rand() * 1.8,
      twinklePhase: rand() * Math.PI * 2,
      isReal,
    }
    stars.push(star)
    if (isReal) realStar = star
  }

  if (!realStar) {
    realStar = stars[0]
  }

  return { stars, realStar }
}

function isRevealedPhase(phase: Phase): boolean {
  return phase === "discovered" || phase === "starring" || phase === "done"
}

function openHref(href: string, openInNewTab: boolean): void {
  if (openInNewTab) {
    window.open(href, "_blank", "noopener,noreferrer")
    return
  }
  window.location.assign(href)
}

export function GitHubSky({
  href = "https://github.com/motoko-ui/motokoui",
  headline = "Every project starts with one star.",
  description = "Maybe this one belongs to you.",
  buttonLabel = "⭐ Star on GitHub",
  hint = "Find the one real star.",
  starCount = STAR_COUNT_DEFAULT,
  seed = 42,
  initiallyRevealed = false,
  onStar,
  openInNewTab = true,
  className,
  style,
  ...props
}: GitHubSkyProps) {
  const reduceMotion = useReducedMotion()
  const count = clamp(Math.round(starCount), STAR_COUNT_MIN, STAR_COUNT_MAX)

  const { stars, realStar } = React.useMemo(
    () => generateStars(count, seed),
    [count, seed]
  )

  const cardRef = React.useRef<HTMLDivElement>(null)
  const atmosphereRef = React.useRef<HTMLDivElement>(null)
  const skyRef = React.useRef<HTMLDivElement>(null)
  const starElsRef = React.useRef<(HTMLSpanElement | null)[]>([])
  const realStarRef = React.useRef<HTMLButtonElement>(null)
  const realCoreRef = React.useRef<HTMLSpanElement>(null)
  const realBloomRef = React.useRef<HTMLSpanElement>(null)
  const githubIconRef = React.useRef<HTMLSpanElement>(null)
  const pointerRef = React.useRef<PointerState>({ x: -1, y: -1, inside: false })
  const rippleRef = React.useRef<RippleState>({ active: false, t: 0, x: 0, y: 0 })
  const cardSizeRef = React.useRef<CardSize>({ width: 1, height: 1 })
  const phaseRef = React.useRef<Phase>("idle")
  const nearAmountRef = React.useRef(0)
  const skyDimRef = React.useRef(0)
  const flightTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const hrefRef = React.useRef(href)
  const onStarRef = React.useRef(onStar)
  const openInNewTabRef = React.useRef(openInNewTab)

  const [phase, setPhase] = React.useState<Phase>(() =>
    initiallyRevealed || reduceMotion ? "discovered" : "idle"
  )
  const [flight, setFlight] = React.useState<FlightState | null>(null)

  hrefRef.current = href
  onStarRef.current = onStar
  openInNewTabRef.current = openInNewTab

  React.useEffect(() => { phaseRef.current = phase }, [phase])

  React.useEffect(() => {
    if (reduceMotion && (phase === "idle" || phase === "near")) {
      setPhase("discovered")
    }
  }, [reduceMotion, phase])

  React.useEffect(() => {
    return () => {
      if (flightTimeoutRef.current !== null) clearTimeout(flightTimeoutRef.current)
    }
  }, [])

  React.useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const updateSize = () => {
      const rect = card.getBoundingClientRect()
      cardSizeRef.current = { width: rect.width || 1, height: rect.height || 1 }
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(card)
    return () => observer.disconnect()
  }, [])

  const setPhaseSafe = React.useCallback((next: Phase) => {
    if (phaseRef.current === next) return
    phaseRef.current = next
    setPhase(next)
  }, [])

  React.useEffect(() => {
    if (reduceMotion) return
    let raf = 0
    let last = performance.now()
    let cancelled = false

    const tick = (now: number) => {
      if (cancelled) return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const { width: w, height: h } = cardSizeRef.current
      const ptr = pointerRef.current
      const px = ptr.inside ? ptr.x / w : -1
      const py = ptr.inside ? ptr.y / h : -1
      const currentPhase = phaseRef.current
      const discovered = isRevealedPhase(currentPhase)

      const rx = realStar.x
      const ry = realStar.y
      let distToReal = 1
      if (ptr.inside) {
        const dx = px - rx
        const dy = py - ry
        distToReal = Math.sqrt(dx * dx + dy * dy)
      }

      const nearT = ptr.inside ? clamp(1 - distToReal / NEAR_RADIUS, 0, 1) : 0
      nearAmountRef.current += (nearT - nearAmountRef.current) * 0.08

      if (!discovered && ptr.inside) {
        if (distToReal < HOVER_RADIUS) {
          setPhaseSafe("discovered")
          rippleRef.current = { active: true, t: 0, x: rx, y: ry }
          skyDimRef.current = 1
        } else if (nearT > 0.35 && currentPhase === "idle") {
          setPhaseSafe("near")
        } else if (nearT < 0.15 && currentPhase === "near") {
          setPhaseSafe("idle")
        }
      }

      if (rippleRef.current.active) {
        rippleRef.current.t += dt
        if (rippleRef.current.t > RIPPLE_DURATION) rippleRef.current.active = false
      }

      if (skyDimRef.current > 0) {
        skyDimRef.current = Math.max(0, skyDimRef.current - dt * 0.45)
      }

      const dim = skyDimRef.current
      if (atmosphereRef.current) atmosphereRef.current.style.opacity = String(1 - dim * 0.35)
      if (skyRef.current) skyRef.current.style.opacity = String(1 - dim * 0.28)

      if (!discovered && realCoreRef.current && realBloomRef.current) {
        const glow = nearAmountRef.current
        const scale = 1 + glow * 0.15
        realCoreRef.current.style.transform = `scale(${scale})`
        realCoreRef.current.style.opacity = String(0.55 + glow * 0.45)
        realBloomRef.current.style.opacity = String(glow * 0.55)
        realBloomRef.current.style.transform = `scale(${0.6 + glow * 0.5})`
      }

      const nearAmt = nearAmountRef.current
      const time = now / 1000
      const els = starElsRef.current

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i]
        if (!star || star.isReal) continue
        const el = els[i]
        if (!el) continue

        const twinkle = 0.55 + 0.45 * Math.sin(time * star.twinkleSpeed * Math.PI * 2 + star.twinklePhase)
        let opacity = star.baseOpacity * twinkle
        let tx = 0
        let ty = 0
        let scale = 1

        if (ptr.inside) {
          const dx = star.x - px
          const dy = star.y - py
          const dist = Math.sqrt(dx * dx + dy * dy)
          const influence = clamp(1 - dist / PARALLAX_RADIUS, 0, 1)

          if (dist > 0.001) {
            const parallax = influence * PARALLAX_STRENGTH
            tx = (dx / dist) * parallax
            ty = (dy / dist) * parallax
          }

          opacity *= 1 + influence * 0.55
          scale = 1 + influence * 0.12

          if (nearAmt > 0) {
            const toReal = Math.hypot(star.x - rx, star.y - ry)
            if (toReal < NEAR_DIM_RADIUS) {
              opacity *= 1 - nearAmt * 0.55 * (1 - toReal / NEAR_DIM_RADIUS)
            }
          }
        }

        if (rippleRef.current.active) {
          const rt = rippleRef.current.t
          const radius = rt * 0.55
          const toRipple = Math.hypot(star.x - rippleRef.current.x, star.y - rippleRef.current.y)
          const ring = Math.abs(toRipple - radius)
          if (ring < 0.04) {
            opacity *= 1 + (1 - ring / 0.04) * 0.9 * (1 - rt / RIPPLE_DURATION)
          } else if (toRipple < radius) {
            opacity *= 0.75 + 0.25 * (rt / RIPPLE_DURATION)
          }
        }

        if (discovered) opacity *= 0.72

        el.style.opacity = String(clamp(opacity, 0.08, 1))
        el.style.transform = `translate3d(calc(-50% + ${tx}px), calc(-50% + ${ty}px), 0) scale(${scale})`
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => { cancelled = true; cancelAnimationFrame(raf) }
  }, [stars, realStar, reduceMotion, setPhaseSafe])

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const card = cardRef.current
      if (!card) return
      const rect = card.getBoundingClientRect()
      cardSizeRef.current = { width: rect.width || 1, height: rect.height || 1 }
      pointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, inside: true }
    },
    []
  )

  const onPointerLeave = React.useCallback(() => {
    pointerRef.current = { x: -1, y: -1, inside: false }
  }, [])

  const revealFromKeyboard = React.useCallback(() => {
    if (phaseRef.current === "idle" || phaseRef.current === "near") {
      setPhaseSafe("discovered")
      rippleRef.current = { active: !reduceMotion, t: 0, x: realStar.x, y: realStar.y }
      if (!reduceMotion) skyDimRef.current = 1
    }
  }, [realStar.x, realStar.y, reduceMotion, setPhaseSafe])

  const handleStarClick = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      if (phaseRef.current === "starring" || phaseRef.current === "done") return

      onStarRef.current?.()

      const navigate = () => openHref(hrefRef.current, openInNewTabRef.current)

      if (reduceMotion) {
        setPhaseSafe("done")
        navigate()
        return
      }

      const realEl = realStarRef.current
      const iconEl = githubIconRef.current
      const card = cardRef.current
      if (!realEl || !iconEl || !card) {
        setPhaseSafe("done")
        navigate()
        return
      }

      const cardRect = card.getBoundingClientRect()
      const from = realEl.getBoundingClientRect()
      const to = iconEl.getBoundingClientRect()

      setFlight({
        fromX: from.left + from.width / 2 - cardRect.left,
        fromY: from.top + from.height / 2 - cardRect.top,
        toX: to.left + to.width / 2 - cardRect.left,
        toY: to.top + to.height / 2 - cardRect.top,
      })
      setPhaseSafe("starring")

      if (flightTimeoutRef.current !== null) clearTimeout(flightTimeoutRef.current)
      flightTimeoutRef.current = setTimeout(() => {
        flightTimeoutRef.current = null
        setPhaseSafe("done")
        setFlight(null)
        navigate()
      }, FLIGHT_MS)
    },
    [reduceMotion, setPhaseSafe]
  )

  const showContent = isRevealedPhase(phase)
  const hideRealStar = phase === "starring" || phase === "done" || flight !== null

  return (
    <div
      ref={cardRef}
      data-slot="github-sky"
      role="region"
      aria-label="Star this project on GitHub"
      onPointerMove={reduceMotion ? undefined : onPointerMove}
      onPointerLeave={reduceMotion ? undefined : onPointerLeave}
      onFocusCapture={revealFromKeyboard}
      className={cn(
        "relative isolate overflow-hidden rounded-2xl",
        "border border-white/[0.08]",
        "bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(48,58,92,0.45),transparent_55%),linear-gradient(165deg,rgba(8,10,18,0.92),rgba(4,5,10,0.96))]",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_24px_80px_-32px_rgba(0,0,0,0.85)]",
        "backdrop-blur-xl",
        "min-h-[320px] w-full max-w-lg",
        "select-none",
        className
      )}
      style={style}
      {...props}
    >
      <div
        ref={atmosphereRef}
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(30,40,70,0.35), transparent 70%)" }}
      />

      <div ref={skyRef} aria-hidden className="pointer-events-none absolute inset-0">
        {stars.map((star, i) => {
          if (star.isReal) return null
          return (
            <span
              key={star.id}
              ref={(el) => { starElsRef.current[i] = el }}
              className="absolute rounded-full bg-white will-change-transform"
              style={{
                left: `${star.x * 100}%`,
                top: `${star.y * 100}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: reduceMotion ? star.baseOpacity : star.baseOpacity * 0.85,
                transform: "translate3d(-50%, -50%, 0)",
                boxShadow: star.size > 2.2 ? `0 0 ${star.size * 2}px rgba(255,255,255,0.7), 0 0 ${star.size * 4}px rgba(147,197,253,0.4)` : undefined,
              }}
            />
          )
        })}
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ boxShadow: "inset 0 0 80px rgba(0,0,0,0.45), inset 0 0 1px rgba(255,255,255,0.06)" }}
      />

      {!hideRealStar && (
        <button
          ref={realStarRef}
          type="button"
          aria-label={showContent ? "The real star — content revealed below" : "Find the real star in the sky"}
          onFocus={revealFromKeyboard}
          onClick={revealFromKeyboard}
          className={cn(
            "absolute z-30 -translate-x-1/2 -translate-y-1/2",
            "rounded-full outline-none",
            "focus-visible:ring-2 focus-visible:ring-amber-200/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          )}
          style={{ left: `${realStar.x * 100}%`, top: `${realStar.y * 100}%`, width: 28, height: 28 }}
        >
          <motion.span
            ref={realCoreRef}
            aria-hidden
            className="absolute inset-0 m-auto block rounded-full will-change-transform"
            style={{
              width: `${realStar.size + 2}px`,
              height: `${realStar.size + 2}px`,
              background: "radial-gradient(circle, rgba(255,248,230,1) 0%, rgba(255,220,160,0.9) 45%, rgba(255,200,120,0) 70%)",
              boxShadow: "0 0 12px 3px rgba(255, 210, 140, 0.8)",
              opacity: 0.8,
            }}
            animate={
              reduceMotion
                ? { scale: 1, opacity: 0.85 }
                : showContent
                  ? { scale: [1.15, 1.05, 1.18, 1.12], opacity: [1, 0.85, 1, 0.92] }
                  : undefined
            }
            transition={
              showContent && !reduceMotion
                ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.65, ease: [0.16, 1, 0.3, 1] }
            }
          />

          <motion.span
            ref={realBloomRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 m-auto rounded-full will-change-transform"
            style={{
              width: "36px",
              height: "36px",
              background: "radial-gradient(circle, rgba(255,210,140,0.45) 0%, rgba(255,180,90,0.2) 40%, transparent 70%)",
              filter: "blur(4px)",
              opacity: 0,
              transform: "scale(0.6)",
            }}
            animate={
              showContent && !reduceMotion
                ? { opacity: 0.9, scale: 1.35 }
                : reduceMotion && showContent
                  ? { opacity: 0.7, scale: 1.2 }
                  : undefined
            }
            transition={EASE_OUT}
          />

          {showContent && !reduceMotion && (
            <motion.span aria-hidden className="pointer-events-none absolute -inset-2 overflow-hidden rounded-full">
              <motion.span
                className="absolute inset-y-0 w-1/2"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,236,190,0.55), transparent)" }}
                initial={{ x: "-120%", opacity: 0 }}
                animate={{ x: ["-120%", "180%"], opacity: [0, 1, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: [0.4, 0, 0.2, 1], repeatDelay: 1.2 }}
              />
            </motion.span>
          )}
        </button>
      )}

      <AnimatePresence>
        {flight && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute z-30 rounded-full"
            initial={{ left: flight.fromX, top: flight.fromY, scale: 1.15, opacity: 1 }}
            animate={{ left: flight.toX, top: flight.toY, scale: 0.55, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.3 }}
            transition={STAR_FLIGHT}
            style={{
              width: "10px", height: "10px", marginLeft: "-5px", marginTop: "-5px",
              background: "radial-gradient(circle, #fff8e8 0%, #ffd090 50%, transparent 75%)",
              boxShadow: "0 0 12px 4px rgba(255,200,120,0.55), 0 0 28px 8px rgba(255,170,80,0.25)",
            }}
          >
            <motion.span
              className="absolute top-1/2 left-1/2 h-1.5 w-10 -translate-x-full -translate-y-1/2 rounded-full"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,210,140,0.45), rgba(255,230,180,0.15))",
                filter: "blur(2px)", transformOrigin: "right center",
              }}
              initial={{ opacity: 0, scaleX: 0.3 }}
              animate={{ opacity: [0, 0.8, 0.4], scaleX: [0.3, 1.2, 0.8] }}
              transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.span>
        )}
      </AnimatePresence>

      <div className="pointer-events-none relative z-20 flex min-h-[320px] flex-col items-center justify-end px-8 pt-16 pb-10 text-center">
        <AnimatePresence mode="wait">
          {showContent && (
            <motion.div
              key="content"
              className="flex w-full max-w-sm flex-col items-center gap-4"
              initial={reduceMotion ? false : { opacity: 0, y: 14, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 6, filter: "blur(4px)" }}
              transition={{ ...CONTENT_EASE, delay: reduceMotion ? 0 : 0.12 }}
            >
              <motion.h2
                className="text-[1.35rem] font-medium tracking-[-0.02em] text-balance text-white/95 sm:text-xl"
                style={{ WebkitFontSmoothing: "antialiased" }}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...CONTENT_EASE, delay: reduceMotion ? 0 : 0.18 }}
              >
                {headline}
              </motion.h2>

              <motion.p
                className="text-sm leading-relaxed text-pretty text-white/50"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...CONTENT_EASE, delay: reduceMotion ? 0 : 0.28 }}
              >
                {description}
              </motion.p>

              <motion.div
                className="pointer-events-auto mt-2"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...CONTENT_EASE, delay: reduceMotion ? 0 : 0.4 }}
              >
                <motion.button
                  type="button"
                  onClick={handleStarClick}
                  disabled={phase === "starring"}
                  aria-label={buttonLabel}
                  className={cn(
                    "group relative inline-flex h-11 items-center gap-2.5 rounded-full px-5",
                    "bg-white/[0.06] text-sm font-medium text-white/90",
                    "border border-white/[0.1]",
                    "shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_8px_32px_-12px_rgba(0,0,0,0.6)]",
                    "backdrop-blur-md",
                    "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] outline-none",
                    "hover:border-white/[0.16] hover:bg-white/[0.1]",
                    "focus-visible:ring-2 focus-visible:ring-white/30",
                    "active:scale-[0.96]",
                    "disabled:pointer-events-none disabled:opacity-60"
                  )}
                  whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                >
                  <span ref={githubIconRef} className="relative flex size-4 items-center justify-center">
                    <Github className="size-4 text-white/80 transition-[color,transform] duration-200 group-hover:text-white" aria-hidden />
                    {phase === "done" && (
                      <motion.span
                        aria-hidden
                        className="absolute inset-0 rounded-full"
                        initial={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: [0.6, 0], scale: 2.2 }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                        style={{ background: "radial-gradient(circle, rgba(255,210,140,0.5), transparent 70%)" }}
                      />
                    )}
                  </span>
                  <span>{buttonLabel}</span>
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {!showContent && (
          <motion.p
            className="pointer-events-none absolute right-0 bottom-8 left-0 text-center text-[11px] tracking-[0.08em] text-white/30"
            initial={{ opacity: 0 }}
            animate={reduceMotion ? { opacity: 0.45 } : { opacity: [0.28, 0.42, 0.28] }}
            transition={reduceMotion ? { duration: 0.4 } : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            {hint}
          </motion.p>
        )}
      </div>

      <a
        href={href}
        className="sr-only"
        {...(openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        Star this project on GitHub
      </a>
    </div>
  )
}

GitHubSky.displayName = "GitHubSky"

/**
 * Stable Celestial Starry Sky Background Component:
 * Clean, serene night sky engine for the application's dark theme.
 * Features 450+ natural twinkling stars across deep space, with no hover movement,
 * no geometric lines, and no distracting large circle blobs.
 */
export function DarkSkyBackground({
  className = "",
  starCount = 450,
  seed = 42,
}: {
  className?: string
  starCount?: number
  seed?: number
}) {
  const reduceMotion = useReducedMotion()
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let rafId = 0
    let lastTime = performance.now()
    let isCancelled = false

    // Sizing
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener("resize", handleResize)

    // Generate stable, deterministic starfield
    const rand = mulberry32(seed)
    const starList: Array<{
      x: number
      y: number
      radius: number
      baseAlpha: number
      twinkleSpeed: number
      phase: number
      color: string
    }> = []

    for (let i = 0; i < starCount; i++) {
      const type = rand()
      let radius = 0.8 + rand() * 0.8 // 0.8px - 1.6px (natural tiny stars)
      let baseAlpha = 0.5 + rand() * 0.4
      let color = "#FFFFFF"

      if (type > 0.88) {
        // Bright stellar beacons
        radius = 2.0 + rand() * 0.8 // 2.0px - 2.8px
        baseAlpha = 0.85 + rand() * 0.15
        color = type > 0.94 ? "#E0F2FE" : "#BAE6FD"
      } else if (type > 0.65) {
        // Medium field stars
        radius = 1.4 + rand() * 0.6 // 1.4px - 2.0px
        baseAlpha = 0.7 + rand() * 0.25
        color = type > 0.78 ? "#F0F9FF" : "#FFFFFF"
      }

      starList.push({
        x: rand(),
        y: rand(),
        radius,
        baseAlpha,
        twinkleSpeed: 0.5 + rand() * 1.5,
        phase: rand() * Math.PI * 2,
        color,
      })
    }

    // Render pure stable stars
    const renderScene = (time: number) => {
      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < starList.length; i++) {
        const star = starList[i]
        const sx = star.x * width
        const sy = star.y * height

        // Organic, serene twinkle
        const twinkle = 0.7 + 0.3 * Math.sin(time * star.twinkleSpeed + star.phase)
        const alpha = star.baseAlpha * twinkle

        // Subtle soft feathering on the brighter stars only
        if (star.radius > 1.8) {
          ctx.beginPath()
          ctx.arc(sx, sy, star.radius * 1.6, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(186, 230, 253, ${alpha * 0.2})`
          ctx.fill()
        }

        // Crisp star core
        ctx.beginPath()
        ctx.arc(sx, sy, star.radius, 0, Math.PI * 2)
        ctx.fillStyle = star.color
        ctx.globalAlpha = alpha
        ctx.fill()
        ctx.globalAlpha = 1
      }
    }

    if (reduceMotion) {
      renderScene(0)
      return () => window.removeEventListener("resize", handleResize)
    }

    const loop = (now: number) => {
      if (isCancelled) return
      renderScene(now / 1000)
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    return () => {
      isCancelled = true
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", handleResize)
    }
  }, [starCount, seed, reduceMotion])

  return (
    <div
      aria-hidden="true"
      className={cn("fixed inset-0 select-none pointer-events-none overflow-hidden", className)}
      style={{
        zIndex: 0,
        width: "100vw",
        height: "100vh",
        background:
          "linear-gradient(180deg, #02050e 0%, #050b18 50%, #02050e 100%)",
      }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none"
      />
    </div>
  )
}

export default GitHubSky
