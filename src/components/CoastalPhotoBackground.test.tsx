import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CoastalPhotoBackground from './CoastalPhotoBackground';

const renderer = vi.hoisted(() => ({ setPaused: vi.fn(), dispose: vi.fn() }));
const start = vi.hoisted(() => vi.fn());
vi.mock('./coastalPhotoMotion', () => ({ startCoastalCinemagraph: start }));
let preference: EventTarget & { matches: boolean };
beforeEach(() => {
  vi.clearAllMocks();
  start.mockReturnValue(renderer);
  preference = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal('matchMedia', () => preference);
  vi.stubGlobal('WebGLRenderingContext', class {});
});
afterEach(() => vi.unstubAllGlobals());

async function loadedPhoto() {
  const view = render(<CoastalPhotoBackground />);
  fireEvent.load(view.container.querySelector('img')!);
  await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  return view;
}

describe('photo motion lifecycle', () => {
  it('lets the user pause and resume and releases the renderer on navigation', async () => {
    const view = await loadedPhoto();
    fireEvent.click(screen.getByRole('button', { name: 'Pause background animation' }));
    expect(renderer.setPaused).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Play background animation' }));
    expect(renderer.setPaused).toHaveBeenLastCalledWith(false);
    view.unmount();
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });
  it('starts still for reduced motion and responds to preference changes', async () => {
    preference.matches = true;
    await loadedPhoto();
    expect(start.mock.calls[0][2]).toBe(true);
    expect(screen.getByRole('button', { name: 'Play background animation' })).toBeInTheDocument();
    act(() => { preference.matches = false; preference.dispatchEvent(new Event('change')); });
    expect(renderer.setPaused).toHaveBeenLastCalledWith(false);
  });
  it('retains the original image when the renderer is unavailable', async () => {
    start.mockImplementationOnce(() => { throw new Error('WebGL unavailable'); });
    const view = await loadedPhoto();
    expect(view.container.querySelector('img')).toHaveAttribute('src', '/assets/home/salish-sea-preview.png');
    expect(view.container.querySelector('.is-ready')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
