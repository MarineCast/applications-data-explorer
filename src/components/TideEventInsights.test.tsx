import {render,screen} from '@testing-library/react';
import {it,expect} from 'vitest';
import TideEventInsights from './TideEventInsights';
import type {SeascapeLayer} from '../data/seascape';
const layer={field:{tideEvents:{stations:{s:{id:'s',name:'Station',provider:'noaa',timezone:'America/Los_Angeles'}},mapping:{cell:{station:'s',distance_km:4}}}},slice:{value:'2024-07-01'},tideEvents:{cell:{high_tide_times_utc:['2024-07-01T03:50:00+00:00','2024-07-01T17:29:00+00:00'],high_tide_local_times:['2024-06-30T20:50:00-07:00','2024-07-01T10:29:00-07:00'],low_tide_times_utc:[],low_tide_local_times:[]}}} as unknown as SeascapeLayer;
it('renders every event with original UTC and previous-local-day offset',()=>{
 render(<TideEventInsights layer={layer} cell="cell"/>);
 expect(screen.getByText('2024-06-30T20:50:00-07:00')).toBeInTheDocument();expect(screen.getByText('2024-07-01T17:29:00+00:00')).toBeInTheDocument();expect(screen.getAllByRole('row')).toHaveLength(3);expect(screen.getByText('No low events reported in this UTC day.')).toBeInTheDocument();
});
it('keeps unsupported cells distinct from empty event lists',()=>{
 render(<TideEventInsights layer={layer} cell="unsupported"/>);expect(screen.getByText(/Unavailable for this cell/)).toBeInTheDocument();expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
