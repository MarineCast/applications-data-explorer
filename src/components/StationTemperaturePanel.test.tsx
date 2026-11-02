import {expect,it,vi} from "vitest";
import {fireEvent,render,screen} from "@testing-library/react";
import StationTemperaturePanel from "./StationTemperaturePanel";
import {stationTemperatureFixture as data} from "../test/stationTemperatureFixture";
import {decodeStationTemperature} from "../data/stationTemperature";
import {hydrologyPointGeoJSON,pickHydrologyPoint} from "../data/hydrologyOverlay";
import {hydrologyFixture} from "../test/hydrologyFixture";
import type {Map as LibreMap} from "maplibre-gl";
it("retains actual station coordinates, distinct identity, sparse dates and marker action",()=>{
 const hydro={...hydrologyFixture(),stationTemperature:data},select=vi.fn();
 const view={data:hydro,metric:"discharge_mean" as const,day:"2026-10-15",onSelect:vi.fn(),onSelectStation:select};
 const points=hydrologyPointGeoJSON(view).features,node=points.find(p=>p.id==="DFO-QUALARK")!;
 expect(node.geometry.coordinates).toEqual([-121.42240833333334,49.53281388888889]);expect(node.properties?.missing).toBe(true);
 expect(points.some(p=>p.properties?.cell)).toBe(true);
 pickHydrologyPoint({queryRenderedFeatures:()=>[node]} as unknown as LibreMap,view,{x:0,y:0});expect(select).toHaveBeenCalledWith("DFO-QUALARK");expect(view.onSelect).not.toHaveBeenCalled();
 expect(decodeStationTemperature(data)).toEqual(data);
 expect(()=>decodeStationTemperature({...data,rows:[...data.rows,data.rows[0]]})).toThrow();
});
it("shows missing current dates, explicit latest observation and disconnected observation dots",()=>{
 const onDate=vi.fn();const props={data,stationId:"DFO-QUALARK",day:"2026-10-15",onDate,onClose:vi.fn()};
 const v=render(<StationTemperaturePanel {...props}/>);
 expect(screen.getByRole('status')).toHaveTextContent('Unavailable on this date');
 expect(screen.getByText(/distinct from WSC Hope/)).toBeInTheDocument();
 const chart=screen.getByRole('img');expect(chart.querySelectorAll('circle')).toHaveLength(2);expect(chart.querySelectorAll('path,polyline')).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:/Latest reported observation/}));expect(onDate).toHaveBeenCalledWith('2026-09-20');
 v.rerender(<StationTemperaturePanel {...props} day="2026-09-20"/>);expect(screen.getByRole('status')).toHaveTextContent('16.1 °C');
 fireEvent.change(screen.getByLabelText('Station temperature date'),{target:{value:'2026-09-19'}});expect(onDate).toHaveBeenLastCalledWith('2026-09-19');
});

import {ecologyTemperatureFixture as ecology} from '../test/ecologyTemperatureFixture';
it('accepts source-qualified Ecology metadata and places each station independently',()=>{
 expect(decodeStationTemperature(ecology)).toEqual(ecology);
 const view={data:{...hydrologyFixture(),stationTemperature:ecology},metric:'discharge_mean' as const,day:'2026-10-27',onSelect:vi.fn(),onSelectStation:vi.fn()};
 const nodes=hydrologyPointGeoJSON(view).features;
 expect(nodes.find(n=>n.id==='ECOLOGY-10A040')?.geometry.coordinates).toEqual([-122.326841,47.208287]);
 expect(nodes.find(n=>n.id==='ECOLOGY-07A089')?.geometry.coordinates).toEqual([-122.10647,47.91248]);
 expect(nodes.find(n=>n.id==='ECOLOGY-10A040')?.properties?.missing).toBe(true);
 expect(nodes.find(n=>n.id==='ECOLOGY-07A089')?.properties?.missing).toBe(false);
});
it('shows fixed PST, unchecked provisional readings and gaps without inventing datum',()=>{
 const props={data:ecology,stationId:'ECOLOGY-07A089',day:'2026-10-27',onDate:vi.fn(),onClose:vi.fn()};
 const v=render(<StationTemperaturePanel {...props}/>);
 expect(screen.getByRole('status')).toHaveTextContent('10.2 °C');
 expect(screen.getByLabelText('Selected observation quality')).toHaveTextContent('Unchecked · Provisional');
 expect(screen.getByText(/fixed UTC-08:00/)).toBeInTheDocument();
 expect(screen.getByText(/Coordinate datum: not explicitly stated/)).toBeInTheDocument();
 v.rerender(<StationTemperaturePanel {...props} day='2026-10-28'/>);
 expect(screen.getByRole('status')).toHaveTextContent('Unavailable');
 expect(screen.queryByLabelText('Selected observation quality')).not.toBeInTheDocument();
 v.rerender(<StationTemperaturePanel {...props} stationId='ECOLOGY-10A040' day='2023-11-15'/>);
 expect(screen.getByRole('status')).toHaveTextContent('5.4 °C');
 expect(screen.getByLabelText('Selected observation quality')).toHaveTextContent('Good quality provisional data');
});
it('keeps Elwha daily statistics separate and exposes the pooling caveat',()=>{
 const props={data:ecology,stationId:'ECOLOGY-EIM-18B070',day:'2009-06-19',onDate:vi.fn(),onClose:vi.fn()};render(<StationTemperaturePanel {...props}/>);
 expect(decodeStationTemperature(ecology)).toEqual(ecology);
 expect(screen.getByRole('status')).toHaveTextContent('10.5979 °C · reported daily mean');
 expect(screen.getByLabelText('Selected observation quality')).toHaveTextContent('Starting to pool');
 fireEvent.change(screen.getByLabelText('Station temperature statistic'),{target:{value:'daily_min'}});expect(screen.getByRole('status')).toHaveTextContent('10.3 °C · reported daily minimum');
 fireEvent.change(screen.getByLabelText('Station temperature statistic'),{target:{value:'daily_max'}});expect(screen.getByRole('status')).toHaveTextContent('10.9 °C · reported daily maximum');
 expect(screen.getByText(/6 observations across 3 statistics; 2 distinct dates/)).toBeInTheDocument();expect(screen.getByRole('img').querySelectorAll('circle')).toHaveLength(2);
 const view={data:{...hydrologyFixture(),stationTemperature:ecology},metric:'discharge_mean' as const,day:'2009-06-19',onSelect:vi.fn(),onSelectStation:vi.fn()};const node=hydrologyPointGeoJSON(view).features.find(n=>n.id==='ECOLOGY-EIM-18B070')!;expect(node.properties?.value).toBe(10.5979);expect(node.geometry.coordinates).toEqual([-123.57773005525759,48.065411269954744]);
});
it('loads Skokomish independently with three statistics and its own quality',()=>{
 const props={data:ecology,stationId:'ECOLOGY-EIM-16A070',day:'2009-06-19',onDate:vi.fn(),onClose:vi.fn()};const v=render(<StationTemperaturePanel {...props}/>);
 expect(decodeStationTemperature(ecology)).toEqual(ecology);
 expect(screen.getByRole('status')).toHaveTextContent('11.01 °C · reported daily mean');
 fireEvent.change(screen.getByLabelText('Station temperature statistic'),{target:{value:'daily_min'}});expect(screen.getByRole('status')).toHaveTextContent('9.69 °C · reported daily minimum');
 fireEvent.change(screen.getByLabelText('Station temperature statistic'),{target:{value:'daily_max'}});expect(screen.getByRole('status')).toHaveTextContent('13.2 °C · reported daily maximum');
 expect(screen.getByLabelText('Selected observation quality')).not.toHaveTextContent('Starting to pool');
 v.rerender(<StationTemperaturePanel {...props} day='2010-01-01'/>);expect(screen.getByRole('status')).toHaveTextContent('Unavailable');
 const view={data:{...hydrologyFixture(),stationTemperature:ecology},metric:'discharge_mean' as const,day:'2009-06-19',onSelect:vi.fn(),onSelectStation:vi.fn()};const node=hydrologyPointGeoJSON(view).features.find(n=>n.id==='ECOLOGY-EIM-16A070')!;
 expect(node.geometry.coordinates).toEqual([-123.17665889452056,47.31000618128145]);expect(node.properties?.value).toBe(11.01);
});
