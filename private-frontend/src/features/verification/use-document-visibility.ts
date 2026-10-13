import { useEffect, useState } from 'react'

type VisibilityDocument = Pick<
  Document,
  'visibilityState' | 'addEventListener' | 'removeEventListener'
>

export function useDocumentVisibility(
  target: VisibilityDocument = document,
): boolean {
  const [documentVisible, setDocumentVisible] = useState(
    () => target.visibilityState !== 'hidden',
  )

  useEffect(() => {
    const updateVisibility = () => {
      setDocumentVisible(target.visibilityState !== 'hidden')
    }

    target.addEventListener('visibilitychange', updateVisibility)
    return () => target.removeEventListener('visibilitychange', updateVisibility)
  }, [target])

  return documentVisible
}
