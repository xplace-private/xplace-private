import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import { Button } from './button'

describe('Button', () => {
  test('renders the Figma variants through the shadcn API', () => {
    const cases = [
      ['default', 'bg-primary'],
      ['secondary', 'bg-secondary'],
      ['destructive', 'bg-destructive'],
      ['outline', 'border-border'],
      ['surface', 'bg-card'],
      ['ghost', 'text-secondary'],
      ['link', 'hover:underline'],
    ] as const

    for (const [variant, expectedClass] of cases) {
      const html = renderToStaticMarkup(
        <Button variant={variant}>{variant}</Button>,
      )

      expect(html).toContain(`data-variant="${variant}"`)
      expect(html).toContain(expectedClass)
    }
  })

  test('derives the Figma sizes from padding instead of fixed heights', () => {
    const cases = [
      ['compact', 'py-px'],
      ['sm', 'py-[5px]'],
      ['nav', 'py-[7px]'],
      ['default', 'py-[7px]'],
      ['md', 'py-[9px]'],
      ['lg', 'py-[13px]'],
      ['chip', 'py-[8.5px]'],
      ['support', 'py-[7px]'],
      ['back', 'p-0'],
      ['icon-sm', 'p-[9px]'],
      ['icon', 'p-[11px]'],
      ['icon-md', 'p-[9px]'],
      ['icon-lg', 'p-[15px]'],
    ] as const

    for (const [size, expectedClass] of cases) {
      const html = renderToStaticMarkup(<Button size={size}>{size}</Button>)

      expect(html).toContain(`data-size="${size}"`)
      expect(html).toContain(expectedClass)
      expect(html).not.toMatch(/(?:^|\s)(?:h|size)-(?:\[|\d)/)
    }
  })

  test('keeps Figma font families and weights explicit', () => {
    const cases = [
      ['regular', 'font-normal'],
      ['strong', 'font-bold'],
      ['light', 'font-sans font-light'],
      ['body', 'font-[family-name:inherit]'],
      ['body-light', 'font-[family-name:inherit]'],
    ] as const

    for (const [textStyle, expectedClass] of cases) {
      const html = renderToStaticMarkup(
        <Button textStyle={textStyle}>{textStyle}</Button>,
      )

      expect(html).toContain(`data-text-style="${textStyle}"`)
      expect(html).toContain(expectedClass)
    }
  })

  test('uses the primary colors for outline interaction states', () => {
    const html = renderToStaticMarkup(<Button variant="outline">Outline</Button>)

    expect(html).toContain('bg-transparent')
    expect(html).toContain('text-foreground')
    expect(html).toContain('hover:bg-primary')
    expect(html).toContain('hover:text-primary-foreground')
    expect(html).toContain('active:bg-primary')
    expect(html).toContain('active:text-primary-foreground')
    expect(html).toContain('data-[state=open]:bg-primary')
    expect(html).toContain('data-[state=open]:text-primary-foreground')
    expect(html).not.toContain('bg-background')
  })

  test('uses the background surface for outline buttons with icons', () => {
    const html = renderToStaticMarkup(
      <Button variant="outline" withIcon>
        Icon
      </Button>,
    )

    expect(html).toContain('bg-background')
    expect(html).not.toContain('bg-transparent')
  })

  test('keeps active chips filled with primary', () => {
    const html = renderToStaticMarkup(
      <Button variant="default" size="chip">
        Active
      </Button>,
    )

    expect(html).toContain('bg-primary')
    expect(html).toContain('text-primary-foreground')
    expect(html).toContain('hover:bg-primary')
    expect(html).not.toContain('bg-foreground')
  })

  test('changes only the surface border on hover', () => {
    const html = renderToStaticMarkup(
      <Button variant="surface">
        <span>Title</span>
        <span>Description</span>
      </Button>,
    )

    expect(html).toContain('hover:border-muted')
    expect(html).not.toContain('hover:bg-primary')
    expect(html).not.toContain('hover:text-primary-foreground')
    expect(html).not.toContain('hover:[&amp;_span]:text-primary-foreground')
  })

  test('keeps non-submit buttons safe by default', () => {
    const html = renderToStaticMarkup(<Button>Open</Button>)

    expect(html).toContain('type="button"')
  })
})
