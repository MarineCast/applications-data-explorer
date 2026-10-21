import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { MapWarningsProvider, MapWarningsRegion } from './MapWarnings';
import WarningNotice from './WarningNotice';

function NestedWarnings() {
  const [failed, setFailed] = useState(true);
  const [unsupported, setUnsupported] = useState(true);
  return <div data-testid="mounted-map">
    {failed && <WarningNotice title="Basemap unavailable" message="Retained source data remains available."
      onRetry={() => setFailed(false)} retryLabel="Retry basemap" />}
    {unsupported && <WarningNotice title="Action unavailable" message="Pair export is unavailable."
      onDismiss={() => setUnsupported(false)} />}
  </div>;
}

it('collects nested warnings and preserves independent retry, dismissal and map lifetime', async () => {
  const user = userEvent.setup();
  render(<MapWarningsProvider><main id="features-explorer"><MapWarningsRegion /><NestedWarnings /></main></MapWarningsProvider>);
  const map = screen.getByTestId('mounted-map');
  const region = screen.getByRole('region', { name: 'Map warnings' });
  expect(within(region).getAllByRole('alert')).toHaveLength(2);
  expect(within(map).queryByRole('alert')).not.toBeInTheDocument();
  await user.click(within(region).getByRole('button', { name: 'Dismiss warning' }));
  expect(within(region).getAllByRole('alert')).toHaveLength(1);
  expect(within(region).getByRole('alert')).toHaveAccessibleName('Basemap unavailable');
  await user.click(within(region).getByRole('button', { name: 'Retry basemap' }));
  expect(within(region).queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByTestId('mounted-map')).toBe(map);
});

it('keeps modal warnings within their dialog while using the same notice presentation', () => {
  render(<MapWarningsProvider><main id="features-explorer"><MapWarningsRegion />
    <dialog open aria-label="Comparison settings"><WarningNotice inline title="Comparison warning" message="Choose distinct variables." /></dialog>
  </main></MapWarningsProvider>);
  const dialog = screen.getByRole('dialog', { name: 'Comparison settings' });
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Choose distinct variables.');
  expect(within(screen.getByRole('region', { name: 'Map warnings' })).queryByRole('alert')).not.toBeInTheDocument();
});
