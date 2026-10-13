import { Button } from './button'
import { TokenIcon } from './token-icon'

interface ActionTileProps {
  description: string
  iconSrc: string
  title: string
  trailingIconSrc: string
  onClick?: () => void
}

/** Reusable content tile with leading and trailing icons. */
export function ActionTile({ description, iconSrc, title, trailingIconSrc, onClick }: ActionTileProps) {
  return (
    <Button
      className="h-auto w-full justify-start gap-4 px-4 py-4 text-left whitespace-normal normal-case"
      variant="surface"
      textStyle="body-light"
      onClick={onClick}
    >
      <TokenIcon className="size-6 text-primary" src={iconSrc} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 font-light">
        <span className="text-xs leading-5 text-foreground">{title}</span>
        <span className="text-xs leading-5 text-secondary">{description}</span>
      </span>
      <TokenIcon className="size-4 rotate-180 text-secondary" src={trailingIconSrc} />
    </Button>
  )
}
