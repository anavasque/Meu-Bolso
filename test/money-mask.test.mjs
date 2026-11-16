import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const warnings=[];const ctx=vm.createContext({toast:s=>warnings.push(s)});
vm.runInContext(src.slice(0,src.indexOf('let data=defaults()'))+';globalThis.api={bindMoneyMask,parseAmount};',ctx);
function input(value=''){
 const node={value,selectionStart:value.length,selectionEnd:value.length,attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;},addEventListener(k,fn){this.events[k]=fn;}};ctx.api.bindMoneyMask(node);return node;
}
test('digit typing inserts Brazilian separators while preserving exact cents',()=>{
 const n=input();for(const digit of '123456'){n.value+=digit;n.selectionStart=n.value.length;n.events.input({inputType:'insertText'});}
 assert.equal(n.value,'1.234,56');assert.equal(ctx.api.parseAmount(n.value),123456);
});
test('editing existing values and deleting the final digit never traps the field at zero',()=>{
 const n=input('1234,56');assert.equal(n.value,'1.234,56');assert.equal(ctx.api.parseAmount(n.value),123456);
 n.value='0,0';n.selectionStart=3;n.events.input({inputType:'deleteContentBackward'});assert.equal(n.value,'');assert.equal(n.selectionStart,0);
});
test('deleting a separator removes an adjacent digit and retains a usable caret',()=>{
 const n=input('1234,56');n.selectionStart=n.selectionEnd=6;let prevented=false;
 n.events.beforeinput({inputType:'deleteContentBackward',cancelable:true,preventDefault:()=>prevented=true});
 assert.equal(prevented,true);assert.equal(n.value,'123,56');assert.equal(ctx.api.parseAmount(n.value),12356);assert.equal(n.selectionStart,4);
});
test('pasting reais converts correctly and malformed values leave the previous amount intact',()=>{
 const n=input();for(const [text,expected] of [['1.234,56','1.234,56'],['1234','1.234,00'],['R$ 25,90','25,90']]){
  n.events.paste({clipboardData:{getData:()=>text},preventDefault(){}});assert.equal(n.value,expected);
 }
 n.events.paste({clipboardData:{getData:()=>'-10,00'},preventDefault(){}});assert.equal(n.value,'25,90');assert(warnings.length);
});
