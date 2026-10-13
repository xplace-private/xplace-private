import { useEffect, useRef, type ReactNode } from 'react'

interface AuthLayoutProps {
  title: string
  description?: string | undefined
  focusKey: string
  texture?: boolean
  icon?: ReactNode
  children: ReactNode
}

/** Visual shell shared by sign-in and password recovery. */
export function AuthLayout({ title, description, focusKey, texture = true, icon, children }: AuthLayoutProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [focusKey])

  return (
    <main data-auth-screen className="relative isolate flex min-h-dvh min-w-0 items-center justify-center p-4 font-sans sm:p-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <img src="/assets/auth/background.webp" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-black/70" />
        {texture && <div className="absolute inset-0 bg-[radial-gradient(circle_at_0.5px_0.5px,white_0.5px,transparent_0.5px)] [background-size:calc((100%_-_1px)/23)_calc((100%_-_1px)/11)] opacity-[0.03]" />}
      </div>
      <div className="flex w-full max-w-[400px] min-w-0 flex-col gap-6">
        <section aria-labelledby="auth-heading" className="flex w-full min-w-0 flex-col gap-6 border border-border bg-card px-5 py-[31px] shadow-xs sm:px-[31px]">
          <div className="flex min-w-0 flex-col items-center gap-3">
            {icon}
            <header className="flex w-full min-w-0 flex-col gap-1 text-center">
              <h1 ref={headingRef} id="auth-heading" tabIndex={-1} className="text-xl leading-8 font-bold outline-none">
                {title}
              </h1>
              {description !== undefined ? <p className="text-xs leading-5 tracking-[0.4px] text-muted-foreground">{description}</p> : null}
            </header>
          </div>
          {children}
        </section>
      </div>
    </main>
  )
}
