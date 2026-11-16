import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
function setup(){
 const handlers={},classes=new Set(),calls=[];let capture=false,clock=1000;
 const row={clientWidth:320,addEventListener:(name,fn)=>handlers[name]=fn,setPointerCapture:()=>capture=true,hasPointerCapture:()=>capture,releasePointerCapture:()=>{capture=false;handlers.lostpointercapture?.({pointerId:1});},classList:{add:x=>classes.add(x),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x)}};
 const card={style:{},addEventListener:(name,fn)=>handlers[name]=fn,setPointerCapture:()=>capture=true,hasPointerCapture:()=>capture,releasePointerCapture:()=>{capture=false;handlers.lostpointercapture?.({pointerId:1});}};
 const ctx=vm.createContext({Date:{now:()=>clock},setTimeout:()=>1,clearTimeout:()=>{},data:{records:[{id:'one',amount:100}]},recordForm:r=>calls.push(['edit',r.id]),deleteRecord:id=>calls.push(['delete',id]),row,card});
 vm.runInContext(source.slice(source.indexOf('function swipeRecord('),source.indexOf('function transaction('))+';swipeRecord(row,card,"one");',ctx);
 const fire=(name,x=0,y=0,extra={})=>{let prevented=false,stopped=false;handlers[name]({pointerId:1,pointerType:'mouse',isPrimary:true,button:0,cancelable:true,clientX:x,clientY:y,preventDefault:()=>prevented=true,stopImmediatePropagation:()=>stopped=true,...extra});return {prevented,stopped};};
 return {fire,calls,classes,card,ctx,tick:()=>clock+=1000};
}
test('right swipe opens edit and suppresses the trailing click',()=>{
 const x=setup();x.fire('pointerdown',120,30);x.fire('pointermove',220,34);
 assert.equal(x.card.style.transform,'translate3d(96.8px,0,0)');assert(x.classes.has('swipe-ready'));assert(x.classes.has('swipe-edit'));
 x.fire('pointerup',220,34);assert.deepEqual(x.calls,[['edit','one']]);assert.equal(x.card.style.transform,'');assert.equal(x.classes.has('dragging'),false);
 assert.deepEqual(x.fire('click'),{prevented:true,stopped:true});x.tick();assert.equal(x.fire('click').prevented,false);
});
test('left swipe requests deletion, with no edit action',()=>{
 const x=setup();x.fire('pointerdown',220,30);x.fire('pointermove',100,30);x.fire('pointerup',100,30);assert.deepEqual(x.calls,[['delete','one']]);
});
test('short and cancelled gestures do not act',()=>{
 for(const ending of ['pointerup','pointercancel','lostpointercapture']){const x=setup();x.fire('pointerdown',100,30);x.fire('pointermove',ending==='pointerup'?140:210,30);x.fire(ending,ending==='pointerup'?140:210,30);assert.equal(x.calls.length,0);assert.equal(x.classes.has('dragging'),false);}
});
test('vertical scroll, multitouch and secondary mouse buttons do not trigger actions',()=>{
 for(const extra of [{},{isPrimary:false},{button:2}]){const x=setup();x.fire('pointerdown',100,30,extra);assert.equal(x.fire('pointermove',104,70).prevented,false);x.fire('pointermove',250,80);x.fire('pointerup',250,80);assert.equal(x.calls.length,0);}
});
test('only the active pointer can finish and deleted records do not reopen',()=>{
 const x=setup();x.fire('pointerdown',100,30);x.fire('pointermove',200,30);x.fire('pointerup',200,30,{pointerId:2});assert.equal(x.calls.length,0);
 vm.runInContext('data.records=[]',x.ctx);x.fire('pointerup',200,30);assert.equal(x.calls.length,0);
});
test('swipe deletion keeps records until confirmation and preserves them on save failure',()=>{
 let action,mutations=0,renders=0;
 const ctx=vm.createContext({data:{records:[{id:'one',amount:100},{id:'two',amount:200}]},money:n=>String(n),confirmDialog:(title,text,fn)=>action=fn,mutate:fn=>{mutations++;return false;},render:()=>renders++,toast:()=>{}});
 vm.runInContext(source.slice(source.indexOf('function deleteRecord('),source.indexOf('function recordsPage('))+';deleteRecord("one");',ctx);
 assert.equal(mutations,0);assert.equal(ctx.data.records.length,2);assert.equal(action(),false);assert.equal(ctx.data.records.length,2);assert.equal(renders,0);
 ctx.mutate=fn=>{fn(ctx.data);return true;};action();assert.equal(ctx.data.records.length,1);assert.equal(ctx.data.records[0].id,'two');assert.equal(renders,1);
});

const touch=(x,y=30,identifier=3)=>({clientX:x,clientY:y,identifier});
function touchFire(x,name,points,ended=[]){return x.fire(name,0,0,{touches:points,changedTouches:ended});}
test('iPhone touch sequence edits with a modest drag and suppresses synthetic click',()=>{
 const x=setup();touchFire(x,'touchstart',[touch(100)]);
 assert.equal(touchFire(x,'touchmove',[touch(130,35)]).prevented,true);
 touchFire(x,'touchend',[],[touch(168,38)]);
 assert.deepEqual(x.calls,[['edit','one']]);assert.equal(x.fire('click').prevented,true);
});
test('diagonal touch can settle horizontally instead of being cancelled early',()=>{
 const x=setup();touchFire(x,'touchstart',[touch(100)]);
 touchFire(x,'touchmove',[touch(110,41)]);assert.equal(x.calls.length,0);
 touchFire(x,'touchmove',[touch(170,50)]);touchFire(x,'touchend',[],[touch(170,50)]);
 assert.deepEqual(x.calls,[['edit','one']]);
});
test('vertical touch scroll and taps keep their native behavior',()=>{
 for(const vertical of [false,true]){const x=setup();touchFire(x,'touchstart',[touch(100)]);
 if(vertical)assert.equal(touchFire(x,'touchmove',[touch(103,70)]).prevented,false);
 touchFire(x,'touchend',[],[touch(vertical?103:100,vertical?70:30)]);assert.equal(x.calls.length,0);assert.equal(x.fire('click').prevented,false);}
});
test('touch cancellation, multiple fingers and pointer duplicates cannot trigger actions',()=>{
 for(const ending of ['touchcancel','multi']){const x=setup();touchFire(x,'touchstart',[touch(160)]);touchFire(x,'touchmove',[touch(80)]);
 if(ending==='multi')touchFire(x,'touchmove',[touch(80),touch(90,30,4)]);else touchFire(x,'touchcancel',[]);
 touchFire(x,'touchend',[],[touch(80)]);assert.equal(x.calls.length,0);}
 const x=setup();x.fire('pointerdown',100,30,{pointerType:'touch'});x.fire('pointermove',200,30,{pointerType:'touch'});x.fire('pointerup',200,30,{pointerType:'touch'});assert.equal(x.calls.length,0);
});
test('returning the finger below the threshold cancels the pending action',()=>{
 const x=setup();touchFire(x,'touchstart',[touch(100)]);touchFire(x,'touchmove',[touch(190)]);touchFire(x,'touchend',[],[touch(120)]);assert.equal(x.calls.length,0);
});
