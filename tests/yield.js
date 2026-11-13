const E=require('../engine.js');
const lv=process.argv[2]||'easy', n=+process.argv[3]||5;
for(let i=0;i<n;i++){const t=Date.now();const r=E.generate(lv,1000+i);console.log(lv,'clues',r.clues,'grade',r.grade.maxRank,'tries',r.tries,'ms',Date.now()-t,JSON.stringify(r.grade.counts));}
