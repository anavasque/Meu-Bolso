import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function chart(records,custom=[],limits={},month='2026-11'){
 const el=(tag,attrs={},...children)=>({tag,attrs,children:children.flat().filter(c=>c!=null),style:{},append(...nodes){this.children.push(...nodes);}});
 const context=vm.createContext({el,data:{limits},month,allCategories:()=>[['food','Alimentação','#f6bbdf'],['home','Casa','#ffe89b'],['other','Outros','#ced6ef'],...custom],svgIcon:id=>el('svg',{id}),empty:message=>el('empty',{},message),money:n=>String(n),records});
 return vm.runInContext(source.slice(source.indexOf('function categoryBarsCard('),source.indexOf('function home()'))+';categoryBarsCard(records)',context);
}
test('categories without expenses and income-only months render no bars',()=>{
 for(const records of [[],[{type:'income',category:'food',amount:10000}]]){const card=chart(records);assert.equal(card.children.length,2);assert.equal(card.children[1].tag,'empty');}
});
test('bars aggregate expenses only, hide absent categories and sort by total',()=>{
 const card=chart([{type:'expense',category:'food',amount:100},{type:'expense',category:'home',amount:600},{type:'expense',category:'food',amount:300},{type:'income',category:'other',amount:9000}]);
 const rows=card.children[1].children;assert.equal(rows.length,2);
 assert.equal(rows[0].children[0].children[1].children[0],'Casa');assert.equal(rows[0].children[0].children[2].children[0],'600');
 assert.equal(rows[0].children[1].children[0].style.width,'60%');assert.equal(rows[1].children[1].children[0].style.width,'40%');
});
test('single expense category uses the full bar',()=>{
 const card=chart([{type:'expense',category:'food',amount:1}]);assert.equal(card.children[1].children[0].children[1].children[0].style.width,'100%');
});

test('custom categories use their selected name, color and icon in the monthly bars',()=>{
 const card=chart([{type:'expense',category:'custom-gym',amount:500}],[['custom-gym','Academia','#bce8da','health']]);
 const row=card.children[1].children[0];assert.equal(row.children[0].children[0].attrs.id,'health');assert.equal(row.children[0].children[1].children[0],'Academia');assert.equal(row.children[1].children[0].style.background,'#bce8da');
});

test('category bars show only the limit defined for the selected month, including custom categories',()=>{
 const records=[{type:'expense',category:'custom-gym',amount:500}],custom=[['custom-gym','Academia','#bce8da','health']];
 const limits={'2026-11:custom-gym':2000,'2026-12:custom-gym':4000};
 for(const [month,expected] of [['2026-11','2000'],['2026-12','4000']]){
   const row=chart(records,custom,limits,month).children[1].children[0];assert.equal(row.children[2].children[0],'Limite do mês: '+expected);
 }
 assert.equal(chart(records,custom,limits,'2027-01').children[1].children[0].children.length,2);
});
