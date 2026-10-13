export type CompleteOnboardingResult =
  | 'completed'
  | 'submission-failed'
  | 'completion-failed'

/** Emits route-level completion only after the final onboarding submission succeeds. */
export async function completeOnboarding(
  continueStep: () => Promise<boolean>,
  onCompleted: () => boolean | void | Promise<boolean | void>,
  alreadySubmitted = false,
): Promise<CompleteOnboardingResult> {
  if (!alreadySubmitted && !(await continueStep())) {
    return 'submission-failed'
  }

  try {
    return (await onCompleted()) === false
      ? 'completion-failed'
      : 'completed'
  } catch {
    return 'completion-failed'
  }
}
