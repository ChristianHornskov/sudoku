// Udskriver alle hint-tekster til gennemlæsning (sprog + bøjning) ud fra rigtige gåder.
const E=require('../engine.js'),H=require('../hints.js');
const seen={};
for(let seed=1;seed<400;seed++){
  for(const lv of ['expert','hard','medium','easy']){
    const g=E.generate(lv,seed*3+1,{maxTries:6}); if(!g) continue;
    const v=g.puzzle.slice(),el=new Array(81).fill(0);
    for(let k=0;k<300;k++){
      const s=E.nextStep(v,el); if(!s||s.error)break;
      if(!seen[s.tech]){const d=H.describe(s,v);seen[s.tech]=d;}
      if(s.place)v[s.place.cell]=s.place.digit; s.elims.forEach(e=>el[e.cell]|=e.mask);
    }
  }
  if(Object.keys(seen).length>=14)break;
}
Object.values(seen).forEach(d=>{console.log('## '+d.tag+'\nVINK: '+d.nudge+'\nFORKLARING: '+d.text+'\nKNAP: '+d.applyLabel+'\n');});
const v=new Array(81).fill(0);
console.log('## fejl\n'+JSON.stringify(H.describeWrong(Object.assign(v.slice(),{0:5,1:5}),v,0),null,0)); 
console.log('## gæt\n'+JSON.stringify(H.describeGuess(10,4)));
