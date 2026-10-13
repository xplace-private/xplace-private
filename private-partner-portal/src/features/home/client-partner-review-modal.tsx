import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { useAppTranslation } from '../../shared/i18n/app-i18n'
import { Badge } from '../../shared/ui/badge'
import { Button } from '../../shared/ui/button'
import { FileUpload, type FileUploadStatus } from '../../shared/ui/file-upload'
import { InfoBanner } from '../../shared/ui/info-banner'
import { Input } from '../../shared/ui/input'
import { Loader } from '../../shared/ui/loader'
import { ModalShell } from '../../shared/ui/modal-shell'
import { MockOutline } from '../../shared/ui/mock-outline'
import type { HomeGateway, PartnerClient } from './api/home-gateway'
import { formatAmountInput, formatAmountOnBlur, parseAmount } from './partner-review-amount'

function MoneyField({ label, value, onChange, invalid }: { label: string; value: string; onChange: (value: string) => void; invalid: boolean }) {
  const { t } = useAppTranslation()
  return <label className="flex min-w-0 flex-col">
    <span className="text-xs font-light leading-5 tracking-[1.6px] text-[#a1a1aa] uppercase">{label}</span>
    <span className={`flex h-12 min-w-0 items-center border-b text-2xl font-light leading-9 focus-within:border-accent ${invalid ? 'border-destructive' : value ? 'border-accent' : 'border-border'}`}>
      <span aria-hidden="true" className={value ? 'leading-9 text-primary' : 'leading-9 text-secondary'}>$&nbsp;</span>
      <Input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          const input = event.currentTarget
          const inputType = 'inputType' in event.nativeEvent ? String(event.nativeEvent.inputType) : ''
          const formatted = formatAmountInput(input.value, input.selectionStart ?? input.value.length, value, inputType)
          onChange(formatted.value)
          queueMicrotask(() => { if (input.isConnected && document.activeElement === input) input.setSelectionRange(formatted.caret, formatted.caret) })
        }}
        onBlur={() => { const formatted = formatAmountOnBlur(value); if (formatted !== null) onChange(formatted) }}
        placeholder="0.00"
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${label.replaceAll(/[^a-z]/gi, '-').toLowerCase()}-error` : undefined}
        className="h-9 min-w-0 flex-1 border-0 py-0 text-2xl leading-9 text-primary shadow-none placeholder:text-secondary focus-visible:border-0 max-sm:text-[max(16px,1.5rem)]"
      />
    </span>
    {invalid ? <span id={`${label.replaceAll(/[^a-z]/gi, '-').toLowerCase()}-error`} role="alert" className="pt-1 text-xs text-destructive">{t('home.clients.partnerReview.invalidAmount')}</span> : null}
  </label>
}

export function ClientPartnerReviewModal({ client, gateway, onClose, returnFocusElement }: { client: PartnerClient; gateway: HomeGateway; onClose: () => void; returnFocusElement: HTMLElement | null }) {
  const { t } = useAppTranslation()
  const queryClient = useQueryClient()
  const uploadController = useRef<AbortController | null>(null)
  const submitController = useRef<AbortController | null>(null)
  const [investable, setInvestable] = useState('')
  const [cash, setCash] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<FileUploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [triedSubmit, setTriedSubmit] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => () => { uploadController.current?.abort(); submitController.current?.abort() }, [])

  function close() {
    uploadController.current?.abort()
    submitController.current?.abort()
    onClose()
  }

  function selectFile(nextFile: File) {
    uploadController.current?.abort()
    const controller = new AbortController()
    uploadController.current = controller
    setFile(nextFile)
    setProgress(0)
    setUploadError('')
    setSubmitError('')
    setUploadStatus('uploading')
    void gateway.uploadAumConfirmation(nextFile, controller.signal, setProgress).then((result) => {
      if (controller.signal.aborted) return
      setUploadStatus(result.ok ? 'attached' : 'error')
      if (!result.ok) setUploadError(t('home.clients.partnerReview.uploadFailed'))
    }).catch(() => {
      if (!controller.signal.aborted) { setUploadStatus('error'); setUploadError(t('home.clients.partnerReview.uploadFailed')) }
    })
  }

  function removeFile() {
    uploadController.current?.abort()
    uploadController.current = null
    setFile(null)
    setProgress(0)
    setUploadStatus('idle')
    setUploadError('')
  }

  async function submit() {
    setTriedSubmit(true)
    const investableAssets = parseAmount(investable)
    const cashAssets = parseAmount(cash)
    if (investableAssets === null || cashAssets === null || !file || uploadStatus !== 'attached' || !confirmed || submitting) return
    const controller = new AbortController()
    submitController.current = controller
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await gateway.submitPartnerReview({ clientId: client.id, investableAssets, cashAssets, file, confirmed }, controller.signal)
      if (controller.signal.aborted) return
      if (!result.ok) { setSubmitError(t('home.clients.partnerReview.submitFailed')); return }
      await queryClient.invalidateQueries({ queryKey: ['home', 'clients'] })
      if (controller.signal.aborted) return
      close()
    } catch {
      if (!controller.signal.aborted) setSubmitError(t('home.clients.partnerReview.submitFailed'))
    } finally {
      if (!controller.signal.aborted) setSubmitting(false)
    }
  }

  if (client.status !== 'partner-review') return null

  return <ModalShell ariaLabel={client.name ?? client.email ?? client.id} onClose={close} returnFocusElement={returnFocusElement} overlayClassName="backdrop-blur-[8px]" panelClassName="max-w-[480px] p-5 font-sans shadow-xs sm:p-[31px]">
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="surface" size="icon-md" className="size-9 bg-background" onClick={close} aria-label={t('common.actions.back')}><img src="/assets/home/arrow-left.svg" alt="" className="size-4 brightness-0 invert" /></Button>
          <h2 className="min-w-0 break-words text-xl font-bold leading-8">{client.name ?? client.email ?? client.id}</h2>
        </div>
        <Badge variant="warning">{t('home.clients.status.partner-review')}</Badge>
      </div>
      <MockOutline enabled><div className="flex min-w-0 flex-col gap-6"><InfoBanner variant="warning">
        <p className="font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs font-normal leading-5">{t('home.clients.partnerReview.noticeTitle')}</p>
        <p className="mt-1 font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-xs font-light leading-5">{t('home.clients.partnerReview.noticeDescription')}</p>
      </InfoBanner>
      <div className="flex min-w-0 flex-col gap-6">
        <MoneyField label={t('home.clients.partnerReview.investableAssets')} value={investable} onChange={setInvestable} invalid={triedSubmit && parseAmount(investable) === null} />
        <MoneyField label={t('home.clients.partnerReview.cashAssets')} value={cash} onChange={setCash} invalid={triedSubmit && parseAmount(cash) === null} />
      </div>
      <FileUpload
        label={t('home.clients.partnerReview.uploadLabel')}
        status={triedSubmit && !file && uploadStatus === 'idle' ? 'error' : uploadStatus}
        file={file}
        progress={progress}
        error={uploadError || (triedSubmit && uploadStatus !== 'attached' ? t('home.clients.partnerReview.fileRequired') : undefined)}
        onFileSelect={selectFile}
        onRemove={removeFile}
        onValidationError={(message) => { removeFile(); setUploadStatus('error'); setUploadError(message) }}
        removeLabel={t('home.clients.partnerReview.removeFile')}
        text={{
          prompt: t('home.clients.partnerReview.uploadPrompt'),
          acceptedFormats: t('home.clients.partnerReview.acceptedFormats'),
          complete: t('home.clients.partnerReview.uploadComplete'),
          retry: t('home.clients.partnerReview.uploadRetry'),
          failed: t('home.clients.partnerReview.uploadFailedLabel'),
          tooLarge: t('home.clients.partnerReview.tooLarge'),
          invalidType: t('home.clients.partnerReview.invalidType'),
          tooManyFiles: t('home.clients.partnerReview.tooManyFiles'),
        }}
      />
      <div>
        <button type="button" role="checkbox" aria-checked={confirmed} onClick={() => setConfirmed((current) => !current)} className={`flex h-12 w-full min-w-0 items-center justify-between gap-2 border px-4 text-left text-sm font-light leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring ${confirmed ? 'border-accent' : 'border-border'}`}>
          <span>{t('home.clients.partnerReview.confirm')}</span>{confirmed
            ? <span aria-hidden="true" className="size-4 shrink-0 bg-accent" style={{ mask: "url('/assets/home/confirm-checked.svg') center / contain no-repeat" }} />
            : <img src="/assets/home/confirm-unchecked.svg" alt="" className="size-4 shrink-0" />}
        </button>
        {triedSubmit && !confirmed ? <p role="alert" className="pt-1 text-xs text-destructive">{t('home.clients.partnerReview.confirmRequired')}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        {submitError ? <p role="alert" className="text-xs text-destructive">{submitError}</p> : null}
        <Button textStyle="strong" className="h-9 w-full" disabled={submitting} aria-busy={submitting} onClick={() => void submit()}>{submitting ? <><Loader decorative /><span className="sr-only">{t('common.loading')}</span></> : t('home.clients.partnerReview.send')}</Button>
      </div>
      </div></MockOutline>
      <Button variant="surface" textStyle="strong" className="h-9 w-full -mt-4" onClick={close}>{t('common.actions.close')}</Button>
    </div>
  </ModalShell>
}
