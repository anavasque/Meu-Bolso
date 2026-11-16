import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const ctx=vm.createContext({Date,Intl,console});
vm.runInContext(source.slice(0,source.indexOf('let data=defaults()'))+';globalThis.api={parseAmount,validateBackup,totals,savedTotal,validDate,defaults};',ctx);
const api=ctx.api;
vm.runInContext('let period="month",anchor="2026-11-13";'+source.slice(source.indexOf('function periodRange()'),source.indexOf('function summary()'))+';globalThis.range=(p,a)=>{period=p;anchor=a;return periodRange();};',ctx);
const record=(amount=100,type='income',date='2026-11-13')=>({id:'r1',amount,type,date,category:'food',note:''});
const transfer=(id,type,amount)=>({id,type,amount,date:'2026-11-13',note:''});
test('Brazilian currency parsing preserves cents and rejects malformed values',()=>{
  for(const [input,result] of [['0,01',1],['25,90',2590],['1.234,56',123456],['R$ 1.000,00',100000],['10',1000],['1,2',120]]) assert.equal(api.parseAmount(input),result,input);
  for(const input of ['','0','-1','1,234','1.23','1e3','Infinity','NaN','10,00x','10.00']) assert.equal(api.parseAmount(input),null,input);
});
test('dates reject impossible calendar values',()=>{
  assert.equal(api.validDate('2024-02-29'),true);
  for(const value of ['2026-02-29','2026-02-30','2026-13-01','2026-00-01','13/11/2026',null]) assert.equal(api.validDate(value),false,String(value));
});
test('backup round trip preserves records and transfers without double counting',()=>{
  const input=api.defaults();input.records=[record(100000)];input.transfers=[transfer('t1','save',30000),transfer('t2','withdraw',5000)];
  const restored=api.validateBackup(JSON.parse(JSON.stringify(input)));
  const totals=api.totals(restored.records),saved=api.savedTotal(restored.transfers),available=totals.income-totals.expense-saved;
  assert.equal(saved,25000);assert.equal(available,75000);assert.equal(available+saved,100000);
});
test('backup rejects duplicate records, invalid money and negative reserved history',()=>{
  for(const modify of [d=>d.records=[record(),record()],d=>d.records=[record(1.5)],d=>d.records=[record(-1)],d=>d.records=[record(1,'unknown')],d=>d.records=[record(1,'expense','2026-02-30')],d=>d.transfers=[transfer('t1','withdraw',100)]]){
    const input=api.defaults();modify(input);assert.throws(()=>api.validateBackup(input));
  }
});
test('backup strips extraneous fields and preserves notes as plain strings',()=>{
  const input=api.defaults();input.records=[{...record(),note:'<img src=x onerror=alert(1)>',injected:'x'}];
  const output=api.validateBackup(input);
  assert.equal(output.records[0].note,input.records[0].note);assert.equal('injected' in output.records[0],false);
});

test('appearance choices survive backup while legacy installations receive the approved font',()=>{
  const legacy=api.defaults();delete legacy.settings.font;
  assert.equal(api.validateBackup(legacy).settings.font,'vt323');
  const choice=api.defaults();choice.settings.font='plex';choice.settings.palette='ocean';choice.settings.theme='dark';
  const restored=api.validateBackup(JSON.parse(JSON.stringify(choice)));
  assert.equal(restored.settings.font,'plex');assert.equal(restored.settings.palette,'ocean');assert.equal(restored.settings.theme,'dark');
  choice.settings.font='pixelify';assert.equal(api.validateBackup(choice).settings.font,'pixelify');
  choice.settings.font='url(https://example.invalid/font)';
  assert.equal(api.validateBackup(choice).settings.font,'vt323');
});

test('approved font migration preserves financial data and allows later font choices',()=>{
  const legacy=api.defaults();delete legacy.settings.typographyVersion;legacy.settings.font='system';
  legacy.settings.palette='garden';legacy.records=[record(400000)];legacy.transfers=[transfer('t1','save',100000)];
  const migrated=api.validateBackup(legacy);
  assert.equal(migrated.settings.font,'vt323');assert.equal(migrated.settings.typographyVersion,1);
  assert.equal(migrated.settings.palette,'garden');assert.equal(migrated.records[0].amount,400000);assert.equal(api.savedTotal(migrated.transfers),100000);
  migrated.settings.font='system';assert.equal(api.validateBackup(migrated).settings.font,'system');
});
test('backup rejects invalid limit month, categories and fractional cents',()=>{
  for(const limits of [{'2026-13:food':100},{'2026-11:unknown':100},{'2026-11:food':1.5}]){
    const input=api.defaults();input.limits=limits;assert.throws(()=>api.validateBackup(input));
  }
});
test('default dataset is empty and currency totals use integer cents',()=>{
  const input=api.defaults();assert.equal(input.records.length,0);assert.equal(input.transfers.length,0);
  const result=api.totals([record(10),record(20),record(1,'expense')]);
  assert.equal(result.income,30);assert.equal(result.expense,1);
});
test('weekly ranges span month and year boundaries, starting Monday',()=>{
  assert.deepEqual(Array.from(ctx.range('week','2026-01-01')),['2025-12-29','2026-01-04']);
  assert.deepEqual(Array.from(ctx.range('week','2026-11-01')),['2026-10-26','2026-11-01']);
});
test('monthly and yearly ranges cover complete calendar periods',()=>{
  assert.deepEqual(Array.from(ctx.range('month','2024-02-29')),['2024-02-01','2024-02-29']);
  assert.deepEqual(Array.from(ctx.range('month','2026-02-13')),['2026-02-01','2026-02-28']);
  assert.deepEqual(Array.from(ctx.range('year','2026-11-13')),['2026-01-01','2026-12-31']);
});
test('money upper bounds keep maximum backup aggregate precisely representable',()=>{
  assert.equal(api.parseAmount('99.999.999,99'),9999999999);
  assert.equal(api.parseAmount('100.000.000,00'),null);
  assert.equal(Number.isSafeInteger(9999999999*100000),true);
  const input=api.defaults();input.records=[record(10000000000)];
  assert.throws(()=>api.validateBackup(input));
});
function storageModel(raw,{failWrite=false}={}){
  let stored=raw;const messages=[];
  const sandbox=vm.createContext({Date,Intl,console,localStorage:{getItem:()=>stored,setItem:(key,value)=>{if(failWrite)throw Error('quota');stored=value;}}});
  vm.runInContext(source.slice(0,source.indexOf('function el('))+';globalThis.toast=message=>globalThis.messages.push(message);globalThis.api={snapshot:()=>JSON.stringify(data),mutate,persist,acceptStored,error:()=>storageError,raw:()=>rawStored};',sandbox);
  sandbox.messages=messages;
  return {api:sandbox.api,messages,context:sandbox,stored:()=>stored,externalWrite:value=>{stored=value;}};
}
test('failed local storage write leaves previous in-memory and stored data intact',()=>{
  const initial=JSON.stringify(api.defaults()),model=storageModel(initial,{failWrite:true});
  assert.equal(model.api.mutate(d=>d.records.push(record(100))),false);
  assert.equal(JSON.parse(model.api.snapshot()).records.length,0);
  assert.equal(model.stored(),initial);
  assert.match(model.messages[0],/Não foi possível salvar/);
});
test('corrupt local data remains untouched and blocks mutation for recovery',()=>{
  const raw='broken-json:{';const model=storageModel(raw);
  assert.match(model.api.error(),/Não foi possível ler/);
  assert.equal(model.api.raw(),raw);
  assert.equal(model.api.mutate(d=>d.records.push(record())),false);
  assert.equal(model.stored(),raw);
});


test('a stale tab cannot overwrite records saved before the storage event arrives',()=>{
  const initial=api.defaults();initial.records=[record(100)];
  const model=storageModel(JSON.stringify(initial));
  const remote=api.defaults();remote.records=[record(100),{...record(200),id:'remote'}];
  const remoteRaw=JSON.stringify(remote);model.externalWrite(remoteRaw);
  const added={...record(300),id:'local'};
  assert.equal(model.api.mutate(d=>d.records.push(added)),false);
  assert.equal(model.stored(),remoteRaw);
  assert.equal(JSON.parse(model.api.snapshot()).records.length,2);
  assert.match(model.messages.at(-1),/mudaram em outra aba/);
  assert.equal(model.api.mutate(d=>d.records.push(added)),true);
  assert.equal(JSON.parse(model.stored()).records.length,3);
});

test('corrupt cross-tab updates preserve their raw contents and block subsequent mutation',()=>{
  const initial=JSON.stringify(api.defaults()),model=storageModel(initial);
  const damaged='invalid-new-data:{';model.externalWrite(damaged);
  assert.equal(model.api.acceptStored(damaged),false);
  assert.equal(model.api.raw(),damaged);assert.match(model.api.error(),/Não foi possível ler/);
  assert.equal(model.api.mutate(d=>d.records.push(record())),false);
  assert.equal(model.stored(),damaged);
  model.externalWrite(initial);assert.equal(model.api.acceptStored(initial),true);
  assert.equal(model.api.error(),'');
  assert.equal(model.api.mutate(d=>d.records.push(record())),true);
});

test('unannounced corrupted storage is not overwritten by a pending save',()=>{
  const model=storageModel(JSON.stringify(api.defaults()));
  model.externalWrite('broken:');
  assert.equal(model.api.mutate(d=>d.records.push(record())),false);
  assert.equal(model.stored(),'broken:');assert.equal(model.api.raw(),'broken:');
  assert.match(model.api.error(),/Não foi possível ler/);
});

test('confirmed imports can intentionally recover corrupted or concurrently changed storage',()=>{
  const model=storageModel('broken:');const restored=api.defaults();restored.records=[record(456)];
  assert.equal(model.api.persist(restored,{replace:true}),true);
  assert.equal(JSON.parse(model.stored()).records[0].amount,456);
  assert.equal(model.api.error(),'');assert.equal(model.api.raw(),model.stored());
});

test('clearing storage in another tab does not resurrect the previous records',()=>{
  const initial=api.defaults();initial.records=[record(123)];
  const model=storageModel(JSON.stringify(initial));model.externalWrite(null);
  assert.equal(model.api.mutate(d=>d.records.push({...record(456),id:'new'})),false);
  assert.equal(model.stored(),null);assert.equal(JSON.parse(model.api.snapshot()).records.length,0);
});

test('writes keep the local state valid for the next app load',()=>{
  const model=storageModel(JSON.stringify(api.defaults()));
  assert.equal(model.api.mutate(d=>d.records.push(record(1.5))),false);
  assert.equal(JSON.parse(model.stored()).records.length,0);
  assert.match(model.messages.at(-1),/registros inválidos/);
  const empty=storageModel('');assert.match(empty.api.error(),/Não foi possível ler/);
});


test('calendar date validation is independent of the device time zone',()=>{
  const code=`const validDate=${api.validDate.toString()};console.log(JSON.stringify([validDate('2026-11-13'),validDate('2024-02-29'),validDate('2026-02-30')]));`;
  for(const tz of ['America/Sao_Paulo','Pacific/Kiritimati','Pacific/Pago_Pago']){
    const result=execFileSync(process.execPath,['-e',code],{env:{...process.env,TZ:tz},encoding:'utf8'}).trim();
    assert.deepEqual(JSON.parse(result),[true,true,false],tz);
  }
});

test('records, reserve, limits and preferences survive closing and loading again',()=>{
  const first=storageModel(null);
  assert.equal(first.api.mutate(d=>{
    d.records=[record(400000),{...record(35000,'expense'),id:'expense'}];
    d.transfers=[transfer('save','save',100000),transfer('withdraw','withdraw',10000)];
    d.limits={'2026-11:food':60000};d.settings.palette='ocean';d.settings.theme='dark';
  }),true);
  const reopened=storageModel(first.stored());
  const restored=JSON.parse(reopened.api.snapshot());
  assert.equal(reopened.api.error(),'');
  assert.equal(restored.records.length,2);assert.equal(api.savedTotal(restored.transfers),90000);
  assert.equal(restored.limits['2026-11:food'],60000);assert.equal(restored.settings.palette,'ocean');assert.equal(restored.settings.font,'vt323');
  assert.equal(api.totals(restored.records).income-api.totals(restored.records).expense-api.savedTotal(restored.transfers),275000);
});


test('backup export includes changes from another tab even before its event arrives',()=>{
  const model=storageModel(JSON.stringify(api.defaults()));
  const remote=api.defaults();remote.records=[record(789)];model.externalWrite(JSON.stringify(remote));
  let exported;
  model.context.Blob=class {constructor(parts){this.parts=parts;}};
  model.context.URL={createObjectURL:blob=>{exported=JSON.parse(blob.parts[0]);return 'blob:test';},revokeObjectURL:()=>{}};
  model.context.document={body:{append:()=>{}}};
  model.context.el=()=>({click:()=>{},remove:()=>{}});
  model.context.render=()=>{};model.context.setTimeout=()=>0;
  vm.runInContext(source.slice(source.indexOf('function exportBackup()'),source.indexOf('function backup()'))+';exportBackup();',model.context);
  assert.equal(exported.records.length,1);assert.equal(exported.records[0].amount,789);
  assert.equal(JSON.parse(model.stored()).records[0].amount,789);
});

const customCategory=()=>({id:'custom-abc',name:'Academia',color:'#bce8da',icon:'health'});
test('legacy backups without category metadata retain every record and limit',()=>{
 const old=api.defaults();delete old.categories;old.records=[record(1200,'expense')];old.limits={'2026-11:food':5000};
 const restored=api.validateBackup(old);assert.equal(restored.categories.length,0);assert.equal(restored.records[0].amount,1200);assert.equal(restored.limits['2026-11:food'],5000);
});
test('new standard categories accept records and limits without renaming old categories',()=>{
 for(const id of ['fixed','installment','credit','internet','mobile','subscription','education','pets']){const d=api.defaults();d.records=[{...record(),category:id}];d.limits['2026-11:'+id]=1234;const restored=api.validateBackup(d);assert.equal(restored.records[0].category,id);assert.equal(restored.limits['2026-11:'+id],1234);}
});
test('custom category, icon, color, records and limits survive storage and backup round trips',()=>{
 const d=api.defaults();d.categories=[customCategory()];d.records=[{...record(),category:'custom-abc'}];d.limits['2026-11:custom-abc']=9000;
 const model=storageModel(JSON.stringify(d));const reloaded=storageModel(model.stored());
 const out=JSON.parse(reloaded.api.snapshot());assert.equal(out.categories[0].icon,'health');assert.equal(out.categories[0].color,'#bce8da');assert.equal(out.records[0].category,'custom-abc');assert.equal(out.limits['2026-11:custom-abc'],9000);
});
test('renaming a custom category preserves record and limit references',()=>{
 const d=api.defaults();d.categories=[customCategory()];d.records=[{...record(),category:'custom-abc'}];d.limits['2026-11:custom-abc']=9000;
 d.categories[0].name='Esporte';d.categories[0].icon='paw';const out=api.validateBackup(d);assert.equal(out.records[0].category,out.categories[0].id);assert.equal(out.limits['2026-11:custom-abc'],9000);
});
test('invalid and duplicate category definitions cannot corrupt saved financial references',()=>{
 const bad=[c=>c.id='food',c=>c.name=' ',c=>c.name='a'.repeat(31),c=>c.icon='https://invalid.test/icon',c=>c.color='red;display:none',c=>c.name=' ALIMENTAÇÃO '];
 for(const edit of bad){const d=api.defaults();const c=customCategory();edit(c);d.categories=[c];assert.throws(()=>api.validateBackup(d));}
 const d=api.defaults();d.categories=[customCategory(),{...customCategory(),id:'custom-def',name:' academia '}];assert.throws(()=>api.validateBackup(d));
 d.categories=[];d.records=[{...record(),category:'custom-missing'}];assert.throws(()=>api.validateBackup(d));
 d.records=[];d.limits={'2026-11:custom-missing':100};assert.throws(()=>api.validateBackup(d));
});

test('income categories and typed custom categories survive backups while legacy categories remain intact',()=>{
 const d=api.defaults();d.categories=[{...customCategory(),name:'Salário'}, {...customCategory(),id:'custom-refund',name:'Reembolso',type:'income'}];
 d.records=[{...record(),type:'income',category:'salary'},{...record(),id:'refund',type:'income',category:'custom-refund'},{...record(),id:'legacy',type:'income',category:'food'}];
 const out=api.validateBackup(d);assert.equal(out.categories[0].type,'expense');assert.equal(out.categories[1].type,'income');assert.equal(out.records[2].category,'food');
 d.categories[1].type='unknown';assert.throws(()=>api.validateBackup(d));
});
test('new income categories are valid for income records but not for spending limits',()=>{
 for(const id of ['salary','advance','vacation','bonus','thirteenth','freelance','income-other']){const d=api.defaults();d.records=[{...record(),type:'income',category:id}];assert.equal(api.validateBackup(d).records[0].category,id);d.limits['2026-11:'+id]=100;assert.throws(()=>api.validateBackup(d));}
});
