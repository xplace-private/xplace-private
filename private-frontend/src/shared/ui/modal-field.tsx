import { useId, type InputHTMLAttributes } from 'react'

interface ModalFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  error?: string | undefined
  inputClassName?: string | undefined
  label: string
}

/** Labeled, shrinkable text field shared by dense modal forms. */
export function ModalField({
  error,
  id,
  inputClassName,
  label,
  'aria-describedby': ariaDescribedBy,
  ...props
}: ModalFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  return (
    <label className="flex min-w-0 flex-col gap-2.5" htmlFor={inputId}>
      <span className="text-[10px] leading-none font-light tracking-[2.2px] text-muted-foreground uppercase">
        {label}
      </span>
      <input
        id={inputId}
        className={`w-full min-w-0 border-0 border-b bg-transparent px-0 pt-1 pb-[14px] text-base leading-none font-light text-foreground shadow-xs outline-none placeholder:text-secondary disabled:opacity-100 ${error ? 'border-destructive' : 'border-border focus:border-accent'} ${inputClassName ?? ''}`}
        aria-describedby={[ariaDescribedBy, error ? errorId : undefined]
          .filter(Boolean)
          .join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? <ModalFieldError id={errorId} message={error} /> : null}
    </label>
  )
}

interface ModalFieldErrorProps {
  id: string
  message: string
}

/** Shared validation message for modal inputs with custom layouts. */
export function ModalFieldError({ id, message }: ModalFieldErrorProps) {
  return (
    <span id={id} className="text-xs leading-none font-light text-destructive">
      {message}
    </span>
  )
}
