import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LiveNorthernSky from './LiveNorthernSky';

describe('live sky chart', () => {
  it('states its observer and keeps Polaris accessible, with a collapsible chart', () => {
    render(<LiveNorthernSky />);
    expect(screen.getByText(/48.55° N/)).toBeInTheDocument();
    const polaris=screen.getByRole('button',{name:/Polaris, altitude/});
    fireEvent.focus(polaris);
    expect(screen.getByText(/bearing/)).toHaveTextContent('Polaris');
    fireEvent.click(screen.getByRole('button',{name:/Northern sky/}));
    expect(screen.queryByRole('group',{name:/North-facing/})).not.toBeInTheDocument();
  });
});
