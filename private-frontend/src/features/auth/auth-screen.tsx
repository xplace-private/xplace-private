import { useAuthFlow } from './auth-flow-provider'
import { CodeStep } from './components/code-step'
import { PhoneStep } from './components/phone-step'

interface AuthScreenProps {
  postAuthenticationPending?: boolean
}

/** Selects and renders the active authentication step. */
export function AuthScreen({ postAuthenticationPending = false }: AuthScreenProps) {
  const { state } = useAuthFlow()

  if (state.step === 'phone') {
    return <PhoneStep />
  }

  return <CodeStep postAuthenticationPending={postAuthenticationPending} />
}
