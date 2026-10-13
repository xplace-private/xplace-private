import { useId, useRef, useState, type ChangeEvent, type DragEvent } from 'react'

export type FileUploadStatus = 'idle' | 'uploading' | 'attached' | 'error'

export interface FileUploadText {
  prompt: string
  acceptedFormats: string
  complete: string
  retry: string
  failed: string
  tooLarge: string
  invalidType: string
  tooManyFiles: string
}

interface FileUploadProps {
  label: string
  status: FileUploadStatus
  file?: File | null
  progress?: number
  error?: string | undefined
  removeLabel: string
  text: FileUploadText
  onFileSelect: (file: File) => void
  onRemove: () => void
  onValidationError: (message: string) => void
}

const maxFileSize = 25 * 1024 * 1024
const acceptedTypes = new Set(['application/pdf', 'image/png', 'image/jpeg'])
const acceptedExtensions = /\.(pdf|png|jpe?g)$/i

// eslint-disable-next-line react-refresh/only-export-components
export function getFileUploadError(file: File): 'invalidType' | 'tooLarge' | undefined {
  if (!acceptedExtensions.test(file.name) || (file.type && !acceptedTypes.has(file.type))) {
    return 'invalidType'
  }
  if (file.size > maxFileSize) return 'tooLarge'
}

export function FileUpload({
  label,
  status,
  file,
  progress = 0,
  error,
  removeLabel,
  text,
  onFileSelect,
  onRemove,
  onValidationError,
}: FileUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isSelectable = status === 'idle' || status === 'error'
  const isError = status === 'error'
  const isActive = isDragging && isSelectable
  const fileSize = file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : ''
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0

  function selectFile(nextFile: File) {
    const validationError = getFileUploadError(nextFile)
    if (validationError) onValidationError(text[validationError])
    else onFileSelect(nextFile)
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.currentTarget.files?.[0]
    if (nextFile) selectFile(nextFile)
    event.currentTarget.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    if (!isSelectable) return
    if (event.dataTransfer.files.length > 1) {
      onValidationError(text.tooManyFiles)
      return
    }
    const nextFile = event.dataTransfer.files[0]
    if (nextFile) selectFile(nextFile)
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 font-sans">
      <div className="flex min-h-5 min-w-0 items-center gap-2">
        <span className="min-w-0 text-xs font-medium leading-5 text-foreground">{label}</span>
        {isError && <span className="text-[8px] leading-4 font-bold tracking-[1.6px] text-destructive uppercase">{text.failed}</span>}
      </div>
      <div
        className={`group flex min-h-36 w-full min-w-0 flex-col items-center border p-6 ${status === 'uploading' || status === 'attached' ? 'justify-start' : 'justify-center'} ${isError ? 'border-dashed border-destructive bg-[#1c0e10]' : status === 'attached' ? 'border-solid border-accent bg-background' : isActive ? 'border-dashed border-primary bg-background' : status === 'uploading' ? 'border-dashed border-border bg-background' : 'border-dashed border-border bg-card'} ${isSelectable ? 'cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary' : ''} ${status === 'idle' ? 'hover:border-primary hover:bg-background focus-within:border-primary focus-within:bg-background' : ''}`}
        onDragEnter={(event) => { if (isSelectable) { event.preventDefault(); setIsDragging(true) } }}
        onDragOver={(event) => { if (isSelectable) event.preventDefault() }}
        onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setIsDragging(false) }}
        onDrop={handleDrop}
        onClick={(event) => {
          if (isSelectable && event.target !== inputRef.current) inputRef.current?.click()
        }}
      >
        {isSelectable && (
          <>
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              className="sr-only"
              onChange={handleInputChange}
              aria-label={label}
              aria-invalid={isError || undefined}
              aria-describedby={isError ? `${inputId}-error` : `${inputId}-hint`}
            />
            <div className="flex w-full min-w-0 cursor-pointer flex-col items-center gap-2 text-center outline-none">
              {isError ? <img src="/assets/upload/warning-circle.svg" alt="" width="24" height="24" /> : (
                <>
                  <img src="/assets/upload/cloud-arrow-up.svg" alt="" width="24" height="24" className={isActive ? 'hidden' : 'group-hover:hidden group-focus-within:hidden'} />
                  <img src="/assets/upload/cloud-arrow-up-hover.svg" alt="" width="24" height="24" className={`brightness-0 invert ${isActive ? '' : 'hidden group-hover:block group-focus-within:block'}`} />
                </>
              )}
              {isError ? (
                <>
                  <span id={`${inputId}-error`} role="alert" className="text-sm leading-6 text-destructive">{error}</span>
                  <span className="text-xs leading-5 font-medium text-muted-foreground">{text.retry}</span>
                </>
              ) : (
                <span className="flex min-w-0 flex-col gap-1">
                  <span className={`text-sm leading-6 group-hover:text-foreground group-focus-within:text-foreground ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>{text.prompt}</span>
                  <span id={`${inputId}-hint`} className="text-xs leading-5 font-medium text-muted-foreground">{text.acceptedFormats}</span>
                </span>
              )}
            </div>
          </>
        )}
        {(status === 'uploading' || status === 'attached') && file && (
          <div className="flex w-full min-w-0 flex-col gap-3">
            <div className="flex w-full min-w-0 items-center gap-3">
              <img src="/assets/upload/file-text.svg" alt="" width="24" height="24" className="shrink-0 brightness-0 invert" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs leading-5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate font-bold tracking-[1.6px] text-foreground uppercase" title={file.name}>{file.name}</span>
                  {status === 'attached' && <span aria-hidden="true" className="size-4 shrink-0 bg-accent" style={{ mask: "url('/assets/upload/check.svg') center / contain no-repeat" }} />}
                </div>
                <span className="truncate font-medium text-secondary">{fileSize}{status === 'attached' && ` • ${text.complete}`}</span>
              </div>
              {status === 'uploading' ? (
                <span className="shrink-0 text-xs leading-5 font-light tracking-[1.6px] text-foreground uppercase">{Math.round(safeProgress)}%</span>
              ) : (
                <button type="button" onClick={onRemove} aria-label={removeLabel} className="flex size-6 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <img src="/assets/upload/x.svg" alt="" width="24" height="24" />
                </button>
              )}
            </div>
            {status === 'uploading' && (
              <div role="progressbar" aria-label={label} aria-valuenow={safeProgress} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
                <div className="h-full rounded-full bg-primary" style={{ width: `${safeProgress}%` }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
