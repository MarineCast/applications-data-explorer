import {render,screen,fireEvent} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {DirectionRose,RankedBars} from './InsightCharts';
describe('shared insight charts',()=>{
 it('uses a common zero baseline for positive and negative measurements',()=>{
  const select=vi.fn();
  const {container}=render(<RankedBars title="Gauges" caption="Daily values" rows={[{key:'a',label:'Positive',value:10,color:'red',onSelect:select},{key:'b',label:'Negative',value:-10,color:'blue'}]}/>);
  const bars=container.querySelectorAll('.insight-bar-track i');
  expect(bars[0]).toHaveStyle({left:'50%',width:'50%'});
  expect(bars[1]).toHaveStyle({left:'0%',width:'50%'});
  fireEvent.click(screen.getByRole('button',{name:/Positive\s*10/}));expect(select).toHaveBeenCalledOnce();
 });
 it('expands ranked categories without discarding smaller counts',()=>{
  render(<RankedBars title="Categories" caption="Records" limit={1} rows={[{key:'a',label:'A',value:0,color:'red'},{key:'b',label:'B',value:3,color:'blue'}]}/>);
  expect(screen.queryByText('A')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Show all 2'}));expect(screen.getByText('A')).toBeVisible();expect(screen.getByText('0')).toBeVisible();
 });
 it('wraps directions around north and excludes missing observations',()=>{
  const {container}=render(<DirectionRose values={[359,0,1,null,NaN,undefined]} color="blue"/>);
  expect(screen.getByText('3 available cells · 30° sectors')).toBeVisible();
  expect(container.querySelectorAll('path')).toHaveLength(1);
  expect(container.querySelector('title')).toHaveTextContent('0°: 3 cells (100.0%)');
 });
});
