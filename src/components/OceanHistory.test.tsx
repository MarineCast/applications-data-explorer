import {render,screen,waitFor,fireEvent} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import OceanHistory from './OceanHistory';
import {loadSeascapeValues,type SeascapeCatalog,type SeascapeFeature} from '../data/seascape';
vi.mock('../data/seascape',()=>({loadSeascapeValues:vi.fn()}));
const field={id:'hycom__current_east_m_s',productId:'pilot',name:'Eastward current · HYCOM (0 m)',unit:'m/s',signed:true} as SeascapeFeature;
function catalog(dates:string[]){return {products:{pilot:{axis:'Date',defaultSlice:dates[0],slices:Object.fromEntries(dates.map(d=>[d,{}]))}}} as unknown as SeascapeCatalog;}
describe('Ocean cell history',()=>{
 it('preserves signed native values and null gaps and allows date selection',async()=>{
  vi.mocked(loadSeascapeValues).mockImplementation(async(_c,_f,d)=>new Map([['cell',d==='2024-07-02'?null:d==='2024-07-01'?-.2:.3]]));
  const change=vi.fn();const {container}=render(<OceanHistory catalog={catalog(['2024-07-01','2024-07-02','2024-07-03'])} field={field} day="2024-07-01" cell="cell" onDate={change}/>);
  const dot=await screen.findByRole('button',{name:'2024-07-03: 0.3 m/s'});fireEvent.click(dot);expect(change).toHaveBeenCalledWith('2024-07-03');
  expect(container.querySelectorAll('circle')).toHaveLength(2);expect(container.querySelectorAll('line')).toHaveLength(1);
 });
 it('bounds long history to 31 daily requests',async()=>{
  vi.mocked(loadSeascapeValues).mockClear().mockResolvedValue(new Map([['cell',null]]));
  const dates=Array.from({length:100},(_,i)=>new Date(Date.UTC(2024,0,i+1)).toISOString().slice(0,10));
  render(<OceanHistory catalog={catalog(dates)} field={field} day={dates[99]} cell="cell" onDate={()=>{}}/>);
  await waitFor(()=>expect(screen.getByText('No qualified values in this window.')).toBeInTheDocument());expect(loadSeascapeValues).toHaveBeenCalledTimes(31);
 });
});
