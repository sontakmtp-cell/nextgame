import { ContractError } from '@prompt-chien/contracts';
import { SIN, COS } from '@prompt-chien/content';
export { isqrt } from '@prompt-chien/brain';
import { isqrt } from '@prompt-chien/brain';
export const Q=1000000;
export const clamp=(n:number,lo:number,hi:number):number=>Math.max(lo,Math.min(hi,n));
export const angle=(n:number):number=>((n%4096)+4096)%4096;
export const signedAngle=(n:number):number=>angle(n+2048)-2048;
export const mulDiv=(a:number,b:number,d:number):number=>Number(BigInt(a)*BigInt(b)/BigInt(d));
export const ceilDiv=(a:number,d:number):number=>Number((BigInt(a)+BigInt(d)-1n)/BigInt(d));
export const norm=(x:number,y:number):number=>Number(isqrt(BigInt(x)**2n+BigInt(y)**2n));
export function normalize(x:number,y:number,limit:number):[number,number] {
  const length=norm(x,y);
  if(length<=limit)return [x,y];
  let a=mulDiv(x,limit,length),b=mulDiv(y,limit,length);
  // isqrt rounds down: trim a unit if the resulting integer vector is outside the cap.
  while(BigInt(a)**2n+BigInt(b)**2n>BigInt(limit)**2n){if(Math.abs(a)>=Math.abs(b))a-=Math.sign(a);else b-=Math.sign(b);}
  return [a,b];
}
export function rotate(x:number,y:number,heading:number):[number,number] {
  const c=BigInt(COS[angle(heading)]!),s=BigInt(SIN[angle(heading)]!);
  return [Number((BigInt(x)*c-BigInt(y)*s)/1000000n),Number((BigInt(x)*s+BigInt(y)*c)/1000000n)];
}
/** Nearest LUT direction by integer dot product; ties choose lower signed index. */
export function bearing(x:number,y:number):number {
  if(x===0&&y===0)return 0;
  // Unimodal first-quadrant search, followed by exact neighboring dot comparisons.
  const ax=Math.abs(x),ay=Math.abs(y);
  let lo=0,hi=1024;
  while(hi-lo>8){const mid=Math.floor((lo+hi)/2);if(BigInt(ay)*BigInt(COS[mid]!)>BigInt(ax)*BigInt(SIN[mid]!))lo=mid;else hi=mid;}
  let best=0,score:bigint|null=null;
  for(let i=lo;i<=hi;i++){
    const direction=x>=0?(y>=0?i:-i):(y>=0?2048-i:i-2048);
    const value=BigInt(x)*BigInt(COS[angle(direction)]!)+BigInt(y)*BigInt(SIN[angle(direction)]!);
    if(score===null||value>score||(value===score&&signedAngle(direction)<signedAngle(best))){score=value;best=direction;}
  }
  return angle(best);
}
export function integrate(rate:number,residual:number):[number,number] {
  const total=rate+residual,whole=Math.trunc(total/60);return [whole,total-whole*60];
}
export function int32(n:number):number {if(!Number.isInteger(n)||n< -2147483648||n>2147483647)throw new ContractError('NUMERIC_RANGE','');return n;}
