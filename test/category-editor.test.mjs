import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function descendants(node){return [node,...node.children.filter(x=>x&&typeof x==='object').flatMap(descendants)];}
function setup(){
 let sequence=0;const dialogs=[];
 function el(tag,attrs={},...children){return {tag,attrs,children:children.flat().filter(x=>x!=null),value:attrs.value??(tag==='textarea'?children.join(''):''),style:{},events:{},setAttribute(k,v){this.attrs[k]=v;},append(...xs){this.children.push(...xs);},replaceChildren(...xs){this.children=xs.flat();},addEventListener(k,v){this.events[k]=v;},querySelectorAll(tag){return descendants(this).slice(1).filter(x=>x.tag===tag);},get lastChild(){return this.children.at(-1);},focus(){}};}
 const context=vm.createContext({Date,Intl,el,svgIcon:id=>el('svg',{id}),crypto:{randomUUID:()=>String(++sequence)},setTimeout:()=>{},dialog:(title,body)=>dialogs.push({title,body}),closeDialog:()=>{},render:()=>{},toast:()=>{},monthName:m=>m});
 vm.runInContext(src.slice(0,src.indexOf('let data=defaults()'))+';let data=defaults();data.settings.reactions=false;',context);
 context.mutate=fn=>{const d=vm.runInContext('data',context);fn(d);vm.runInContext('data=validateBackup(data)',context);return true;};
 vm.runInContext(src.slice(src.indexOf('function segments('),src.indexOf('function recordForm('))+src.slice(src.indexOf('function recordForm('),src.indexOf('function showReaction('))+src.slice(src.indexOf('function categoryEditor('),src.indexOf('function categoriesPage(')),context);
 return {context,dialogs,snapshot:()=>JSON.parse(vm.runInContext('JSON.stringify(data)',context))};
}
test('creating a category inside a draft keeps its amount and note and submits the chosen icon category',()=>{
 const x=setup();vm.runInContext('recordForm()',x.context);const form=x.dialogs[0].body;
 const amount=descendants(form).find(n=>n.attrs['aria-label']==='Valor em reais'),note=descendants(form).find(n=>n.tag==='textarea');amount.value='12,34';note.value='Meu rascunho';
 const name=descendants(form).find(n=>n.attrs.placeholder==='Ex.: Academia');name.value='Academia';
 descendants(form).find(n=>n.attrs['aria-label']==='Celular').attrs.onclick();
 descendants(form).find(n=>n.tag==='button'&&n.children.includes('Criar categoria')).attrs.onclick();
 assert.equal(amount.value,'12,34');assert.equal(note.value,'Meu rascunho');assert.equal(x.snapshot().categories[0].icon,'phone');
 form.events.submit({preventDefault(){}});const state=x.snapshot();assert.equal(state.records[0].amount,1234);assert.equal(state.records[0].note,'Meu rascunho');assert.equal(state.records[0].category,state.categories[0].id);
});
test('duplicate names show an error instead of saving a category',()=>{
 const x=setup();const editor=vm.runInContext('categoryEditor(null,()=>{})',x.context);descendants(editor).find(n=>n.tag==='input').value='Internet';
 descendants(editor).find(n=>n.tag==='button'&&n.children.includes('Criar categoria')).attrs.onclick();assert.equal(x.snapshot().categories.length,0);assert.match(descendants(editor).find(n=>n.attrs.role==='alert').textContent,/existe/);
});

function submitRecord(x,{type='expense',category='food',date='2026-11-15'}={}){
 x.context.existingRecord=undefined;
 vm.runInContext('recordForm()',x.context);const form=x.dialogs.at(-1).body;
 if(type==='income')descendants(form).find(n=>n.tag==='button'&&n.children.includes('Entrada')).attrs.onclick();
 if(category!=='food')descendants(form).find(n=>n.tag==='button'&&n.children.includes(category==='home'?'Casa':category)).attrs.onclick();
 descendants(form).find(n=>n.attrs['aria-label']==='Valor em reais').value='10,00';descendants(form).find(n=>n.attrs.type==='date').value=date;
 form.events.submit({preventDefault(){}});
}
test('first expense prompts only after saving; declining keeps it and later expenses do not prompt',()=>{
 const x=setup();submitRecord(x);assert.equal(x.snapshot().records.length,1);assert.equal(x.dialogs.at(-1).title,'Que tal definir um limite?');
 descendants(x.dialogs.at(-1).body).find(n=>n.tag==='button'&&n.children.includes('Agora não')).attrs.onclick();
 const before=x.dialogs.length;submitRecord(x);assert.equal(x.snapshot().records.length,2);assert.equal(x.dialogs.length,before+1);
});
test('limit prompt skips income, existing limits, edited records and previously used categories',()=>{
 const x=setup();const record={type:'expense',category:'food',date:'2026-11-15'};x.context.checkRecord=record;
 assert.equal(vm.runInContext('shouldOfferLimit(checkRecord,false,data)',x.context),false);
 submitRecord(x,{type:'income'});assert.equal(x.dialogs.length,1);
 vm.runInContext("data.limits['2026-11:food']=5000",x.context);submitRecord(x);assert.equal(x.dialogs.length,2);
 const y=setup();submitRecord(y);const before=y.dialogs.length;submitRecord(y,{date:'2026-12-15'});assert.equal(y.dialogs.length,before+1);
});
test('accepting opens Limits for the saved category and expense month',()=>{
 const x=setup();let target,category;
 x.context.navigate=id=>target=id;x.context.limitForm=id=>category=id;
 vm.runInContext("let month='2027-01'",x.context);submitRecord(x,{category:'home',date:'2026-10-15'});
 descendants(x.dialogs.at(-1).body).find(n=>n.tag==='button'&&n.children.includes('Definir limite')).attrs.onclick();
 assert.equal(target,'limites');assert.equal(category,'home');assert.equal(vm.runInContext('month',x.context),'2026-10');assert.equal(x.snapshot().records.length,1);
});
test('failed save never opens a limit prompt',()=>{
 const x=setup();x.context.mutate=()=>false;submitRecord(x);assert.equal(x.dialogs.length,1);assert.equal(x.snapshot().records.length,0);
});

test('switching to income shows income categories only and keeps the draft value and note',()=>{
 const x=setup();vm.runInContext('recordForm()',x.context);const form=x.dialogs[0].body;
 const amount=descendants(form).find(n=>n.attrs['aria-label']==='Valor em reais'),note=descendants(form).find(n=>n.tag==='textarea');amount.value='123,45';note.value='Pagamento';
 descendants(form).find(n=>n.tag==='button'&&n.children.includes('Entrada')).attrs.onclick();
 const names=descendants(form).filter(n=>n.tag==='button'&&n.attrs.class?.startsWith('category-button')).flatMap(n=>n.children.filter(c=>typeof c==='string'));
 for(const name of ['Salário','Adiantamento mensal','Férias','Bônus','Décimo terceiro','Freelance'])assert(names.includes(name));assert(!names.includes('Alimentação'));assert(!names.includes('Cartão de crédito'));
 assert.equal(amount.value,'123,45');assert.equal(note.value,'Pagamento');
 descendants(form).find(n=>n.tag==='button'&&n.children.includes('Freelance')).attrs.onclick();form.events.submit({preventDefault(){}});
 const r=x.snapshot().records[0];assert.equal(r.type,'income');assert.equal(r.category,'freelance');assert.equal(r.amount,12345);assert.equal(r.note,'Pagamento');
});
test('custom income categories inherit the current type and do not appear as expense options',()=>{
 const x=setup();vm.runInContext('recordForm()',x.context);const form=x.dialogs[0].body;
 descendants(form).find(n=>n.tag==='button'&&n.children.includes('Entrada')).attrs.onclick();descendants(form).find(n=>n.attrs.placeholder==='Ex.: Academia').value='Reembolso';
 descendants(form).find(n=>n.tag==='button'&&n.children.includes('Criar categoria')).attrs.onclick();assert.equal(x.snapshot().categories[0].type,'income');
 assert(descendants(form).some(n=>n.tag==='button'&&n.children.includes('Reembolso')));
 descendants(form).find(n=>n.tag==='button'&&n.children.includes('Gasto')).attrs.onclick();assert(!descendants(form).some(n=>n.tag==='button'&&n.children.includes('Reembolso')));
 assert(descendants(form).some(n=>n.tag==='button'&&n.children.includes('Alimentação')));
});
test('editing a legacy income keeps its original category unless the user chooses another',()=>{
 const x=setup();vm.runInContext("data.records=[{id:'legacy',type:'income',category:'food',amount:1200,date:'2026-11-15',note:'Antigo'}];recordForm(data.records[0])",x.context);
 const form=x.dialogs.at(-1).body;form.events.submit({preventDefault(){}});assert.equal(x.snapshot().records[0].category,'food');assert.equal(x.snapshot().records[0].amount,1200);
});
