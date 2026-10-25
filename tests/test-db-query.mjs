// Query-builder adapter for isolated handler tests; mirrors only the Convex
// operations exercised by these tests. It never touches a live database.
export function queryRows(getRows) {
  let predicates=[],direction='asc'
  const value=x=>typeof x==='function'?x:()=>x
  const cmp=fn=>(a,b)=>row=>fn(value(a)(row),value(b)(row))
  const ops={field:key=>row=>row[key],eq:cmp((a,b)=>a===b),neq:cmp((a,b)=>a!==b),lt:cmp((a,b)=>a<b),lte:cmp((a,b)=>a<=b),gt:cmp((a,b)=>a>b),gte:cmp((a,b)=>a>=b),and:(...p)=>row=>p.every(f=>f(row)),or:(...p)=>row=>p.some(f=>f(row))}
  const api={withIndex(_name,callback){const index={eq(key,target){predicates.push(row=>row[key]===target);return index},lt(key,target){predicates.push(row=>row[key]<target);return index},lte(key,target){predicates.push(row=>row[key]<=target);return index},gt(key,target){predicates.push(row=>row[key]>target);return index},gte(key,target){predicates.push(row=>row[key]>=target);return index}};callback?.(index);return api},filter(callback){predicates.push(callback(ops));return api},order(next){direction=next;return api},async collect(){return getRows().filter(row=>predicates.every(p=>p(row))).slice().sort((a,b)=>((a._creationTime||0)-(b._creationTime||0))*(direction==='desc'?-1:1))},async take(n){return(await api.collect()).slice(0,n)},async first(){return(await api.collect())[0]||null},async unique(){const rows=await api.collect();if(rows.length>1)throw Error('Expected unique');return rows[0]||null}}
  return api
}
