import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import HomePage from './HomePage';

it('recolors the sidebar only after each directional scene sweep ends', () => {
  const view = render(<HomePage onNavigate={() => {}} />);
  const home = screen.getByRole('main', { name: 'MarineCast home' });
  const initial = home.getAttribute('data-theme');
  const next = initial === 'dark' ? 'light' : 'dark';
  const complete = (theme: string) => {
    const event = new Event('animationend', { bubbles: true });
    Object.defineProperty(event, 'animationName', { value: `coastal-${theme}-from-east` });
    fireEvent(view.container.querySelector('.coastal-night-layer')!, event);
  };
  fireEvent.click(screen.getByRole('button', { name: next === 'dark' ? 'Switch to night mode' : 'Switch to day mode' }));
  expect(home).toHaveAttribute('data-theme', next);
  expect(home).toHaveAttribute('data-sidebar-theme', initial);
  complete(initial!); // A stale animation must not recolor the sidebar.
  expect(home).toHaveAttribute('data-sidebar-theme', initial);
  complete(next);
  expect(home).toHaveAttribute('data-sidebar-theme', next);
  fireEvent.click(screen.getByRole('button', { name: initial === 'dark' ? 'Switch to night mode' : 'Switch to day mode' }));
  expect(home).toHaveAttribute('data-sidebar-theme', next);
  complete(initial!);
  expect(home).toHaveAttribute('data-sidebar-theme', initial);
});
