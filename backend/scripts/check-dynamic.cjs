// Run against the seeded local backend: node scripts/check-dynamic.cjs
// Creates a temporary draft and upload, then removes those test artifacts.
const assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const fs=require('fs');
for(const line of fs.readFileSync(require('path').join(__dirname, '../.env'),'utf8').split('\n')){const m=line.match(/^DATABASE_URL=["']?(.*?)["']?$/);if(m)process.env.DATABASE_URL=m[1];}
const db=new PrismaClient(); let propertyId; const tokens=[];let passed=0;
async function req(path,token,method='GET',body){const r=await fetch('http://localhost:4000/api'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();return {status:r.status,data};}
function check(name,yes){assert.ok(yes,name);passed++;console.log('PASS',name);}
(async()=>{try{
const sessions={};for(const [role,email] of Object.entries({admin:'ahad@placein.com',agency:'sarah@aminaproperties.my',tech:'tech@placein.com'})){const r=await req('/auth/login',null,'POST',{email,password:'PlaceIn2026!'});check(role+' login',r.status===201);sessions[role]=r.data;tokens.push(r.data.accessToken);} const a=sessions.admin.accessToken,o=sessions.agency.accessToken,t=sessions.tech.accessToken;
check('unauthenticated access rejected',(await req('/properties')).status===401);
check('invalid login rejected',(await req('/auth/login',null,'POST',{email:'ahad@placein.com',password:'incorrect-password'})).status===401);
check('maintenance invoices denied',(await req('/invoices',t)).status===403);
check('maintenance user export denied',(await req('/exports/users',t)).status===403);
check('agency office dashboard denied',(await req('/dashboard/office',o)).status===403);
const agencies=(await req('/agencies',a)).data.data;const other=agencies.find(x=>x.id!==sessions.agency.user.agencyId);
check('cross-agency detail denied',(await req('/agencies/'+other.id,o)).status===403);
check('cross-agency filter denied',(await req('/properties?agencyId='+other.id,o)).status===403);
for(const [route,key,val] of [['properties','publication','DRAFT'],['properties','status','AVAILABLE'],['agencies','status','ACTIVE'],['agents','agencyId',sessions.agency.user.agencyId],['enquiries','status','CLOSED'],['invoices','status','OVERDUE']]){const r=await req('/'+route+'?'+key+'='+val,a);check(route+' '+key+' filter',r.status===200&&r.data.data.every(x=>key==='agencyId'?x.agencyId===val||x.agency?.id===val:x[key]===val));}
const p1=await req('/properties?pageSize=2&page=1',a),p2=await req('/properties?pageSize=2&page=2',a);check('pagination distinct pages',p1.data.data.length===2&&p2.data.data.length===2&&!p1.data.data.some(x=>p2.data.data.some(y=>x.id===y.id)));
check('empty search',(await req('/properties?q=nonexistent-check-739204',a)).data.total===0);
for(const route of ['properties','enquiries']){const code=await req('/'+route+'?country=MY',a),name=await req('/'+route+'?country=Malaysia',a);check(route+' country code matches name',code.status===200&&code.data.total>0&&code.data.total===name.data.total);}
for(const kind of ['properties','agencies','users','invoices']){const response=await fetch('http://localhost:4000/api/exports/'+kind,{headers:{Authorization:'Bearer '+a}});check(kind+' CSV export',response.status===200&&(await response.text()).includes(','));}
const form=new FormData();form.append('file',new Blob(['temporary upload check'],{type:'text/plain'}),'dynamic-check.txt');
const upload=await fetch('http://localhost:4000/api/uploads',{method:'POST',headers:{Authorization:'Bearer '+o},body:form});const file=await upload.json();
check('upload accepted',upload.status===201&&file.url.startsWith('/uploads/'));
try{const fetched=await fetch('http://localhost:4000'+file.url);check('uploaded file served',(await fetched.text())==='temporary upload check');}finally{fs.unlinkSync(require('path').join(__dirname, '../uploads', require('path').basename(file.url)));}
check('invalid pagination',(await req('/properties?page=-1',a)).status===400);
check('invalid property form',(await req('/properties',o,'POST',{})).status===400);
check('missing upload file',(await req('/uploads',o,'POST')).status===400);
const draft=await req('/properties',o,'POST',{title:'Temporary dynamic check',listingType:'SALE',propertyType:'Apartment',price:100,currency:'MYR',beds:1,baths:1,sizeSqft:500,description:'Temporary check record; removed after verification.'});propertyId=draft.data.id;check('create draft',draft.status===201&&draft.data.publication==='DRAFT');
check('incomplete draft blocked',(await req('/properties/'+propertyId+'/submit',o,'POST',{})).status===400);
const edit=await req('/properties/'+propertyId,o,'PATCH',{title:'Temporary updated check',countryName:'Malaysia',city:'Kuala Lumpur',area:'Test area'});check('edit persisted',edit.status===200&&edit.data.title==='Temporary updated check');
const photos=await req('/properties/'+propertyId+'/photos',o,'POST',{photos:[{url:'https://example.test/check.jpg',width:10,height:10,isCover:true}]});check('photo quality scored',photos.status===201&&photos.data.mediaQuality==='FAIL');
check('bad-quality publication blocked',(await req('/properties/'+propertyId+'/submit',o,'POST',{})).status===400);
await req('/auth/logout',o,'POST');check('revoked token rejected',(await req('/auth/me',o)).status===401);
console.log('TOTAL PASSED',passed);
}finally{if(propertyId){await db.moderationItem.deleteMany({where:{entityId:propertyId}});await db.auditLog.deleteMany({where:{entityId:propertyId}});await db.property.delete({where:{id:propertyId}});}for(const token of tokens)await req('/auth/logout',token,'POST');await db.$disconnect();}})().catch(e=>{console.error(e);process.exitCode=1});
