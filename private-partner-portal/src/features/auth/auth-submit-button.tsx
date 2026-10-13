import { Button } from '../../shared/ui/button'
import { Loader } from '../../shared/ui/loader'

export function AuthSubmitButton({ pending, disabled = false, label, className }: { pending: boolean; disabled?: boolean; label: string; className?: string }) {
  return (
    <Button type="submit" textStyle="strong" className={className} disabled={pending || disabled} aria-label={label}>
      <span className="relative inline-grid place-items-center">
        <span className={pending ? 'invisible' : undefined}>{label}</span>
        {pending ? <span className="absolute inset-0 grid place-items-center"><Loader /></span> : null}
      </span>
    </Button>
  )
}
