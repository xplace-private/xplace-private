import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { OnboardingSelectionStep } from './onboarding-selection-step'

function radioClasses(html: string, checked: boolean): string {
  const classes = html.match(
    new RegExp(
      `<button[^>]*class="([^"]+)"[^>]*role="radio"[^>]*aria-checked="${checked}"`,
    ),
  )?.[1]
  if (!classes) throw new Error(`Radio option with checked=${checked} was not rendered`)
  return classes
}

describe('OnboardingSelectionStep', () => {
  test('renders the shared heading, choices, warning, and actions', () => {
    const html = renderToStaticMarkup(
      <OnboardingSelectionStep
        eyebrow="APPLICATION · STEP 3 OF 6"
        title="Choose a value"
        description="Selection description."
        ariaLabel="Example values"
        options={[
          { value: 'first', label: 'First value' },
          { value: 'second', label: 'Second value' },
        ]}
        selectedValue={null}
        error="Select to continue"
        pending={false}
        onSelect={() => undefined}
        onContinue={() => undefined}
        onBack={() => undefined}
      />,
    )

    expect(html).toContain('APPLICATION · STEP 3 OF 6')
    expect(html).toContain('<h1')
    expect(html).toContain('Choose a value')
    expect(html).toContain('role="radiogroup"')
    expect(html.match(/role="radio"/g)).toHaveLength(2)
    expect(html).toContain('Select to continue')
    expect(html).toContain('>Continue</span></button>')
    expect(html).toContain('>Back</button>')
  })

  test('keeps the selected option transparent and changes only its border', () => {
    const html = renderToStaticMarkup(
      <OnboardingSelectionStep
        eyebrow="APPLICATION · STEP 3 OF 6"
        title="Choose a value"
        description="Selection description."
        ariaLabel="Example values"
        options={[
          { value: 'first', label: 'First value' },
          { value: 'second', label: 'Second value' },
        ]}
        selectedValue="first"
        error={null}
        pending={false}
        onSelect={() => undefined}
        onContinue={() => undefined}
        onBack={() => undefined}
      />,
    )
    const selectedClasses = radioClasses(html, true)
    const neutralClasses = radioClasses(html, false)

    expect(neutralClasses).toContain('hover:border-muted')
    expect(neutralClasses).toContain('hover:bg-transparent')
    expect(neutralClasses).toContain('hover:text-foreground')
    expect(neutralClasses).toContain('hover:[&amp;_img]:brightness-100')
    expect(selectedClasses).toContain('border-accent')
    expect(selectedClasses).toContain('active:bg-transparent')
    expect(selectedClasses).not.toContain('bg-card')
    expect(selectedClasses).not.toContain('hover:border-muted')
  })
})
