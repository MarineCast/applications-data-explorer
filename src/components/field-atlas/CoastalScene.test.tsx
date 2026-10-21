import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CoastalScene from './CoastalScene';

const props={paused:false,driving:false,zoom:1,resetView:0,onZoom:vi.fn(),onExit:vi.fn(),onAvailability:vi.fn()};
afterEach(()=>vi.unstubAllGlobals());
it('keeps the scene quiet while assets are pending, without the old raster illustration',()=>{
  vi.stubGlobal('WebGLRenderingContext',class {});
  vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));
  render(<CoastalScene {...props}/>);
  expect(screen.getByRole('status')).toHaveTextContent('Loading coastal atlas');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(props.onAvailability).toHaveBeenLastCalledWith(false);
});
it('reports an unavailable scene without returning to the bright fallback',async()=>{
  vi.stubGlobal('WebGLRenderingContext',class {});
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')));
  render(<CoastalScene {...props}/>);
  expect(await screen.findByText('Interactive coastal map unavailable')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
