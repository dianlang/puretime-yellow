import fs from 'node:fs';

// Original, very quiet synthetic ambience. No commercial recordings or borrowed melodies.
const rate = 22050;
function writeWav(file, seconds, sample) {
  const n = Math.round(rate*seconds), b = Buffer.alloc(44+n*2);
  b.write('RIFF',0); b.writeUInt32LE(36+n*2,4); b.write('WAVEfmt ',8);
  b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22);
  b.writeUInt32LE(rate,24); b.writeUInt32LE(rate*2,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34);
  b.write('data',36); b.writeUInt32LE(n*2,40);
  for(let i=0;i<n;i++) b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample(i/rate,seconds)))*32767),44+i*2);
  fs.writeFileSync(file,b);
}
fs.mkdirSync('game/bgm',{recursive:true}); fs.mkdirSync('game/vocal',{recursive:true});
for(const [name,frequencies] of Object.entries({journey:[110,164.8,220],memory:[130.8,196,261.6],night:[82.4,123.47,164.8]})) {
  writeWav(`game/bgm/${name}.wav`,24,(t,d)=>{
    const fade=Math.min(1,t/3,(d-t)/3);
    return fade * frequencies.reduce((s,f,i)=>s+Math.sin(2*Math.PI*f*t+0.13*Math.sin(t*0.5))/(i+1),0)*0.045*(0.8+0.2*Math.sin(t*0.4));
  });
}
writeWav('game/vocal/chime.wav',3,t=>(Math.sin(2*Math.PI*880*t)+0.35*Math.sin(2*Math.PI*1320*t))*Math.exp(-t*3)*Math.min(t*80,1)*0.18);
writeWav('game/vocal/tap.wav',0.3,t=>Math.sin(2*Math.PI*(190*t-180*t*t))*Math.exp(-t*25)*Math.min(t*200,1)*0.2);
