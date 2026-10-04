export interface ContractSource {
 id:string; contractId:string; title:string; version:string; page:number; section:string; excerpt:string;
}
export type Obligation='payment'|'documents';
export interface DeadlineEvidence {
 obligation:Obligation; status:'supported'|'missing'|'needs_review'; date:string|null;
 sources:ContractSource[];
}
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
// Strict fixture grammar, not general legal interpretation or semantic RAG.
// Unknown wording, contradictory evidence, and multiple active contracts require review.
export function resolveDeadline(sources:ContractSource[],obligation:Obligation):DeadlineEvidence {
 const relevant=sources.filter(s=>obligation==='payment'?s.section==='Section 4 — Final payment':s.section==='Section 5 — Required documents');
 if(!relevant.length)return {obligation,status:'missing',date:null,sources:[]};
 const prefix=obligation==='payment'?'The remaining booking balance must be paid by ':'Passport copies must be submitted by ';
 const dates=relevant.map(s=>{
  if(!s.excerpt.startsWith(prefix))return null;
  const match=s.excerpt.slice(prefix.length).match(/^([A-Za-z]+) ([0-9]{1,2}), ([0-9]{4})\.$/);
  if(!match)return null;
  const month=months.indexOf(match[1]!)+1,day=Number(match[2]),year=Number(match[3]);
  if(!month || year<2000 || year>2100)return null;
  const date=new Date(Date.UTC(year,month-1,day));
  if(date.getUTCMonth()!==month-1 || date.getUTCDate()!==day)return null;
  return date.toISOString().slice(0,10);
 });
 const supported=dates.every(d=>d!==null)&&new Set(dates).size===1&&new Set(relevant.map(s=>s.contractId)).size===1;
 return {obligation,status:supported?'supported':'needs_review',date:supported?dates[0]!:null,sources:relevant};
}
