import { useId, useState, type InputHTMLAttributes } from 'react'

import { cn } from '../../shared/cn'
import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { ModalFieldError } from '../../shared/ui/modal-field'

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string | undefined
  recovery?: boolean
}

export function AuthField({ label, error, recovery = false, className, onChange, value, defaultValue, ...props }: AuthFieldProps) {
  const { t } = useAppTranslation()
  const id = useId()
  const [inputValue, setInputValue] = useState(defaultValue ?? '')
  const [validationError, setValidationError] = useState<string | undefined>()
  const fieldError = error ?? validationError

  return (
    <div className="flex min-w-0 flex-col">
      <label htmlFor={id} className={cn('text-xs leading-5 font-light tracking-[1.6px] text-secondary uppercase', recovery && fieldError && "font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-[10px] leading-3 tracking-[2.2px]")}>{label}</label>
      <input
        {...props}
        id={id}
        value={value ?? inputValue}
        required
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={fieldError ? `${id}-error` : undefined}
        className={cn('h-12 w-full min-w-0 rounded-none border-0 border-b bg-transparent px-0 py-1 text-2xl leading-9 font-light text-foreground outline-none placeholder:text-base placeholder:text-secondary/80 disabled:opacity-100', fieldError ? 'border-destructive' : 'border-border focus:border-accent', recovery && 'max-w-80', recovery && fieldError && 'mt-1 max-w-full', className)}
        onInvalid={(event) => {
          event.preventDefault()
          const field = event.currentTarget
          setValidationError(t(field.validity.typeMismatch ? 'auth.errors.email' : 'common.errors.required'))
          if (field.form?.querySelector('input:invalid') === field) field.focus()
        }}
        onChange={(event) => {
          setInputValue(event.currentTarget.value)
          setValidationError(undefined)
          onChange?.(event)
        }}
      />
      {fieldError ? recovery ? <span id={`${id}-error`} className="mt-1 text-[8px] leading-4 text-destructive" role="alert">{fieldError}</span> : <span className="mt-2" role="alert"><ModalFieldError id={`${id}-error`} message={fieldError} /></span> : null}
    </div>
  )
}

export function AuthError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="text-xs leading-5 text-destructive">{message}</p> : null
}
