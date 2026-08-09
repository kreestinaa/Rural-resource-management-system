import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Approved</Badge>)
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('applies the default variant when none given', () => {
    render(<Badge>Default</Badge>)
    const el = screen.getByText('Default')
    expect(el.className).toContain('bg-gray-100')
  })

  it('applies a named colour variant', () => {
    render(<Badge variant="green">Live</Badge>)
    expect(screen.getByText('Live').className).toContain('bg-green-100')
  })

  it('falls back to default for an unknown variant', () => {
    render(<Badge variant="not-a-color">X</Badge>)
    expect(screen.getByText('X').className).toContain('bg-gray-100')
  })

  it('merges custom className', () => {
    render(<Badge className="custom-xyz">Y</Badge>)
    expect(screen.getByText('Y').className).toContain('custom-xyz')
  })
})
