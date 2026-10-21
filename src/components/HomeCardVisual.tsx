import { useEffect, useRef } from 'react';

type Kind = 'map' | 'relationships' | 'models' | 'forecasts';

// Decorative navigation motifs, not measured data, model output, or forecasts.
export default function HomeCardVisual({ kind, theme }: { kind: Kind; theme: 'light' | 'dark' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = 720; canvas.height = 480;
    ctx.scale(2, 2);
    ctx.strokeStyle = theme === 'dark' ? '#9de2d8' : '#346e70'; ctx.fillStyle = theme === 'dark' ? '#bfeee7' : '#346e70'; ctx.lineWidth = 0.8;
    const curve = (points: number[][]) => {
      ctx.beginPath();
      points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
      ctx.stroke();
    };
    if (kind === 'map') {
      for (let band=0; band<17; band++) {
        ctx.globalAlpha = 0.15 + band/40;
        curve(Array.from({length:121},(_,i) => {
          const t=i*Math.PI/60;
          const radius=22+band*7+Math.sin(t*3)*9+Math.cos(t*5)*5;
          return [210+Math.cos(t)*radius,105+Math.sin(t)*radius*.65];
        }));
      }
    } else if (kind === 'relationships') {
      const nodes=[[95,110],[155,50],[195,130],[265,65],[290,175],[145,205],[225,215]];
      for (const [a,b] of [[0,1],[0,2],[0,5],[1,2],[1,3],[2,3],[2,4],[2,5],[2,6],[3,4],[4,6],[5,6]]) {
        ctx.globalAlpha=.4; curve([nodes[a],nodes[b]]);
      }
      nodes.forEach(([x,y],i) => {
        ctx.globalAlpha=.1; ctx.beginPath();ctx.arc(x,y,12+i%3*3,0,Math.PI*2);ctx.fill();
        ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(x,y,3+i%2,0,Math.PI*2);ctx.fill();
      });
    } else if (kind === 'models') {
      for (let band=0;band<9;band++) {
        ctx.globalAlpha=band===4?.9:.2;ctx.lineWidth=band===4?1.7:.8;
        curve(Array.from({length:101},(_,i) => [45+i*3,160-Math.sin(i/24)*45-Math.cos(i/15+band*.09)*18+(band-4)*(i/17)]));
      }
    } else {
      for (let row=0;row<10;row++) for(let col=0;col<14;col++) {
        const x=65+col*20,y=25+row*22;
        const angle=Math.sin(row*.38)+Math.cos(col*.23);
        ctx.globalAlpha=.18+.45*(1+Math.sin(row*.5-col*.35))/2;
        ctx.save();ctx.translate(x,y);ctx.rotate(angle);
        curve([[-5,0],[6,0],[2,-3]]);curve([[6,0],[2,3]]);ctx.restore();
      }
    }
  }, [kind, theme]);
  return <div className={`coastal-card-visual visual-${kind}`} aria-hidden="true"><canvas ref={ref} /></div>;
}
