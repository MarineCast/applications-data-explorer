import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import App from './App';
import { setAppTheme } from './theme/appTheme';

afterEach(() => { setAppTheme('light'); window.history.replaceState(null,'','/'); });
it('carries night mode from Home into Features, allows switching there, and restores it on Home', () => {
  window.history.replaceState(null,'','/');
  act(()=>setAppTheme('light'));
  render(<App />);
  fireEvent.click(screen.getByRole('button',{name:'Switch to night mode'}));
  expect(document.documentElement).toHaveAttribute('data-app-theme','dark');
  fireEvent.click(within(screen.getByRole('navigation',{name:'Atlas destinations'})).getByRole('button',{name:'Features'}));
  expect(document.querySelector('.app')).toHaveAttribute('data-app-theme','dark');
  expect(screen.getByRole('heading',{name:'Features'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Switch to day mode'}));
  expect(document.documentElement).toHaveAttribute('data-app-theme','light');
  fireEvent.click(screen.getByRole('link',{name:'MarineCast home'}));
  expect(screen.getByRole('main',{name:'MarineCast home'})).toHaveAttribute('data-theme','light');
});
