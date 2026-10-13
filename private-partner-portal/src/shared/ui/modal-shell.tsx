import * as Dialog from '@radix-ui/react-dialog'
import { useRef, type ReactNode } from 'react'

import { cn } from '../cn'
import { focusModalShell } from './modal-interactions'

interface ModalShellProps {
  ariaLabel: string
  children: ReactNode
  closeDisabled?: boolean
  overlayClassName?: string
  panelClassName?: string
  returnFocusElement?: HTMLElement | null
  onClose: () => void
}

/** Responsive modal foundation shared by feature-owned dialog contents. */
export function ModalShell({
  ariaLabel,
  children,
  closeDisabled = false,
  overlayClassName,
  panelClassName,
  returnFocusElement,
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
      <Dialog.Overlay className={cn('fixed inset-0 z-50 flex min-w-0 items-center justify-center overflow-hidden bg-background/72 px-5 pt-[max(20px,env(safe-area-inset-top,0px))] pb-[max(20px,env(safe-area-inset-bottom,0px))] text-foreground backdrop-blur-[16px]', overlayClassName)}>
        <Dialog.Content
          ref={panelRef}
          className={cn('max-h-full w-full max-w-lg min-w-0 overflow-y-auto overscroll-contain border border-border bg-card outline-none', panelClassName)}
          aria-label={ariaLabel}
          aria-describedby={undefined}
          data-close-disabled={closeDisabled}
          tabIndex={-1}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            openerRef.current = document.activeElement
            if (panelRef.current) focusModalShell(panelRef.current)
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const opener = returnFocusElement ?? openerRef.current
            if (opener instanceof HTMLElement) opener.focus({ preventScroll: true })
          }}
          onEscapeKeyDown={keepOpenWhileBusy}
          onInteractOutside={keepOpenWhileBusy}
        >
          <Dialog.Title className="sr-only">{ariaLabel}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Root>
  )
}
