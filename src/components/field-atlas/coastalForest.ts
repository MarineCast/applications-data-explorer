/** Little-endian float32 records: x, terrain height, z, scale, wind phase, tree variant. */
export function decodeForest(buffer:ArrayBuffer,count:number):Float32Array {
  if(!Number.isInteger(count)||count<=0||buffer.byteLength!==count*6*4)throw Error('Incomplete forest');
  const trees=new Float32Array(buffer);
  for(let i=0;i<trees.length;i++)if(!Number.isFinite(trees[i]))throw Error('Invalid forest record');
  for(let i=0;i<trees.length;i+=6)if(trees[i+3]<=0||![0,1,2].includes(trees[i+5]))throw Error('Invalid tree shape');
  return trees;
}
/** Dense nearby boughs; inexpensive evergreen crowns preserve forest cover at atlas scale. */
export function forestDetail(zoom:number){
  const distant=zoom<1.8;
  const fraction=distant?.75:1;
  return {distant,fraction,canopyScale:distant?1.12:1};
}
