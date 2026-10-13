import * as Dialog from '@radix-ui/react-dialog'
import { useRef, type ReactNode } from 'react'

import { focusModalShell } from './modal-interactions'

interface ModalShellProps {
  ariaLabel: string
  children: ReactNode
  closeDisabled?: boolean
  panelClassName?: string
  onClose: () => void
}

/** Responsive modal foundation shared by feature-owned dialog contents. */
export function ModalShell({
  ariaLabel,
  children,
  closeDisabled = false,
  panelClassName,
  onClose,
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)

  const keepOpenWhileBusy = (event: Event) => {
    if (closeDisabled) event.preventDefault()
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <Dialog.Overlay className="fixed inset-0 z-50 flex min-w-0 items-center justify-center overflow-hidden bg-background/72 px-5 pt-[max(20px,env(safe-area-inset-top,0px))] pb-[max(20px,env(safe-area-inset-bottom,0px))] text-foreground backdrop-blur-[16px]">
        <Dialog.Content
          ref={panelRef}
          className={`max-h-full w-full max-w-[400px] min-w-0 overflow-y-auto overscroll-contain border border-border bg-card outline-none ${panelClassName ?? ''}`}
          aria-label={ariaLabel}
          data-close-disabled={closeDisabled}
          tabIndex={-1}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            openerRef.current = document.activeElement
            if (panelRef.current) focusModalShell(panelRef.current)
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const opener = openerRef.current
            if (opener instanceof HTMLElement) opener.focus({ preventScroll: true })
          }}
          onEscapeKeyDown={keepOpenWhileBusy}
          onInteractOutside={keepOpenWhileBusy}
        >
          {children}
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  )
}
