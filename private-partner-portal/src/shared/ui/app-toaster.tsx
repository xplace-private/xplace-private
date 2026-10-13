import { Toaster } from 'sonner'
import 'sonner/dist/styles.css'

const toastDurationMs = 2500
const toastMaxWidth = 'min(480px, calc(100% - 32px))'

/** App-level notification renderer styled to the product toast design. */
export function AppToaster() {
  return (
    <Toaster
      className="app-toaster"
      position="bottom-center"
      duration={toastDurationMs}
      gap={8}
      offset={{ bottom: 'max(24px, env(safe-area-inset-bottom))' }}
      mobileOffset={{ bottom: 'max(24px, env(safe-area-inset-bottom))' }}
      style={{ width: 'fit-content' }}
      toastOptions={{
        unstyled: true,
        style: {
          width: 'max-content',
          maxWidth: toastMaxWidth,
          border: '1px solid var(--border)',
          borderRadius: 0,
          background: 'var(--popover)',
          color: 'var(--foreground)',
          boxShadow: 'none',
        },
        classNames: {
          toast:
            'flex items-center gap-3 px-5 py-3 [&:has([data-icon])]:px-3',
          icon: 'shrink-0',
          content: 'min-w-0 flex-1',
          title:
            'text-pretty text-xs leading-4 font-light tracking-[1.2px] uppercase whitespace-normal break-words',
        },
      }}
    />
  )
}
