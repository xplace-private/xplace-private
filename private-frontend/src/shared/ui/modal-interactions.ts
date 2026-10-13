interface ModalShellFocusTarget {
  focus: (options: FocusOptions) => void
}

/** Keeps initial dialog focus out of form controls so mobile keyboards stay closed. */
export function focusModalShell(dialog: ModalShellFocusTarget) {
  dialog.focus({ preventScroll: true })
}
