'use strict';
const KEY='bolso-v1', money=n=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}), $=s=>document.querySelector(s);
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const monthOf=s=>s.slice(0,7), currentMonth=()=>monthOf(today());
const cats=[['food','Alimentação','#f6bbdf'],['transport','Transporte','#a9dff1'],['home','Casa','#ffe89b'],['leisure','Lazer','#d7c3f4'],['health','Saúde','#bce8da'],['shopping','Compras','#efc8bd'],['fixed','Gasto fixo','#d7c3f4','bill'],['installment','Parcela fixa','#c4dded','receipt'],['credit','Cartão de crédito','#efbed9','card'],['internet','Internet','#bce8da','wifi'],['mobile','Celular','#ced6ef','phone'],['subscription','Assinaturas','#f6d5b5','bill'],['education','Educação','#ffe89b','registros'],['pets','Pets','#efc8bd','paw'],['other','Outros','#ced6ef']];
const incomeCats=[['salary','Salário','#bce8da','coins'],['advance','Adiantamento mensal','#a9dff1','card'],['vacation','Férias','#ffe89b','leisure'],['bonus','Bônus','#f6bbdf','pig'],['thirteenth','Décimo terceiro','#d7c3f4','bill'],['freelance','Freelance','#efc8bd','registros'],['income-other','Outras entradas','#ced6ef','other']];
const categoryIcons=[['food','Alimentação'],['transport','Transporte'],['home','Casa'],['leisure','Lazer'],['health','Saúde'],['shopping','Compras'],['bill','Conta fixa'],['receipt','Parcelas'],['card','Cartão'],['wifi','Internet'],['phone','Celular'],['registros','Estudos'],['paw','Pets'],['coins','Moedas'],['pig','Cofrinho'],['other','Outros']];
const categoryColors=['#f6bbdf','#d7c3f4','#a9dff1','#bce8da','#ffe89b','#efc8bd','#ced6ef','#f6d5b5'];
const categoryNameKey=name=>name.trim().normalize('NFKC').toLocaleLowerCase('pt-BR');
function allCategories(state=data){return [...cats,...incomeCats,...state.categories.map(c=>[c.id,c.name,c.color,c.icon])];}
function categoriesFor(type,state=data){const built=type==='income'?incomeCats:cats;return [...built,...state.categories.filter(c=>(c.type||'expense')===type).map(c=>[c.id,c.name,c.color,c.icon])];}
const category=id=>allCategories().find(c=>c[0]===id)||cats[cats.length-1];
const categoryIcon=id=>{const c=category(id);return c[3]||c[0];};
const defaults=()=>({version:1,categories:[],records:[],transfers:[],limits:{},settings:{palette:'candy',theme:'auto',font:'vt323',typographyVersion:1,reactions:true,large:50000,motion:true,splash:true},lastBackup:null});
function validateCategories(raw){
  if(raw===undefined)return [];
  if(!Array.isArray(raw)||raw.length>100)throw Error('Use até 100 categorias personalizadas.');
  const ids=new Set([...cats,...incomeCats].map(c=>c[0])),names=new Set([...cats.map(c=>'expense:'+categoryNameKey(c[1])),...incomeCats.map(c=>'income:'+categoryNameKey(c[1]))]);
  return raw.map(c=>{
    if(c?.type!==undefined&&!['expense','income'].includes(c.type))throw Error('Tipo de categoria inválido.');
    if(!c||typeof c.id!=='string'||!/^custom-[a-zA-Z0-9-]{1,64}$/.test(c.id)||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.trim().length>30||typeof c.color!=='string'||!/^#[a-f0-9]{6}$/i.test(c.color)||!categoryIcons.some(i=>i[0]===c.icon))throw Error('Há categorias personalizadas inválidas.');
    const name=c.name.trim(),type=c.type||'expense',key=type+':'+categoryNameKey(name);if(names.has(key))throw Error('Já existe uma categoria com esse nome.');
    ids.add(c.id);names.add(key);return {id:c.id,name,color:c.color,icon:c.icon,type};
  });
}
function parseAmount(v){const s=String(v).trim().replace(/R\$\s*/g,'').replace(/\s/g,'');if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(s))return null;const n=Math.round(Number(s.replace(/\./g,'').replace(',','.'))*100);return Number.isSafeInteger(n)&&n>0&&n<=9999999999?n:null;}
function formatMoneyDigits(value){
  const digits=String(value).replace(/\D/g,'').replace(/^0+(?=\d)/,'');
  if(!digits)return '';
  const padded=digits.padStart(3,'0'),integer=padded.slice(0,-2).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return integer+','+padded.slice(-2);
}
function bindMoneyMask(input){
  input.setAttribute('inputmode','numeric');input.setAttribute('autocomplete','off');input.setAttribute('spellcheck','false');
  input.setAttribute('aria-description','Digite os números, incluindo os centavos. A vírgula e os pontos são automáticos.');
  const apply=(raw=input.value,position=input.selectionStart??raw.length,deleting=false)=>{
    if(deleting&&!/[1-9]/.test(raw)){input.value='';input.setSelectionRange?.(0,0);return;}
    const right=raw.slice(position).replace(/\D/g,'').length,formatted=formatMoneyDigits(raw);
    input.value=formatted;
    let cursor=formatted.length,count=0;
    while(cursor>0&&count<right){cursor--;if(/\d/.test(formatted[cursor]))count++;}
    input.setSelectionRange?.(cursor,cursor);
  };
  input.addEventListener('input',e=>{if(!e.isComposing)apply(input.value,input.selectionStart??input.value.length,e.inputType?.startsWith('delete'));});
  input.addEventListener('compositionend',()=>apply());
  input.addEventListener('beforeinput',e=>{
    if(e.cancelable===false)return;
    const start=input.selectionStart,end=input.selectionEnd;
    if(start==null||start!==end)return;
    const backward=e.inputType==='deleteContentBackward',forward=e.inputType==='deleteContentForward';
    if(!backward&&!forward)return;
    const raw=input.value,index=backward?start-1:start;
    if(index<0||index>=raw.length||/\d/.test(raw[index]))return;
    let digit=index;
    while(digit>=0&&digit<raw.length&&!/\d/.test(raw[digit]))digit+=backward?-1:1;
    if(digit<0||digit>=raw.length)return;
    e.preventDefault();apply(raw.slice(0,digit)+raw.slice(digit+1),digit,true);
  });
  input.addEventListener('paste',e=>{
    const text=e.clipboardData?.getData('text');if(text==null)return;
    e.preventDefault();const cents=parseAmount(text);
    if(cents===null){toast('Cole um valor em reais, como 1.234,56.');return;}
    input.value=formatMoneyDigits(String(cents));input.setSelectionRange?.(input.value.length,input.value.length);
  });
  if(input.value)input.value=formatMoneyDigits(input.value);
}
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const validMoney=n=>Number.isSafeInteger(n)&&n>0&&n<=9999999999;
function validateBackup(raw){if(!raw||raw.version!==1||!Array.isArray(raw.records)||!Array.isArray(raw.transfers)||raw.records.length+raw.transfers.length>100000)throw Error('O arquivo não é um backup válido do Bolso.');const d=defaults(),ids=new Set();d.categories=validateCategories(raw.categories);const allowed=new Set(allCategories(d).map(c=>c[0]));for(const r of raw.records){if(!r||typeof r.id!=='string'||ids.has(r.id)||!validMoney(r.amount)||!['income','expense'].includes(r.type)||!allowed.has(r.category)||!validDate(r.date)||typeof r.note!=='string'||r.note.length>120)throw Error('Há registros inválidos no arquivo.');ids.add(r.id);d.records.push({id:r.id,amount:r.amount,type:r.type,category:r.category,date:r.date,note:r.note});}ids.clear();for(const t of raw.transfers){if(!t||typeof t.id!=='string'||ids.has(t.id)||!validMoney(t.amount)||!['save','withdraw'].includes(t.type)||!validDate(t.date)||typeof t.note!=='string'||t.note.length>120)throw Error('Há movimentos inválidos no arquivo.');ids.add(t.id);d.transfers.push({id:t.id,amount:t.amount,type:t.type,date:t.date,note:t.note});}let saved=0;for(const t of d.transfers){saved+=t.type==='save'?t.amount:-t.amount;if(saved<0)throw Error('O histórico de dinheiro guardado é inválido.');}if(!raw.limits||typeof raw.limits!=='object'||Array.isArray(raw.limits))throw Error('Os limites do arquivo são inválidos.');const allowedLimits=new Set(categoriesFor('expense',d).map(c=>c[0]));for(const [k,v] of Object.entries(raw.limits)){const match=k.match(/^\d{4}-(?:0[1-9]|1[0-2]):(.+)$/);if(!match||!allowedLimits.has(match[1])||!validMoney(v))throw Error('Há limites inválidos no arquivo.');d.limits[k]=v;}const s=raw.settings||{};if(['candy','peach','ocean','garden'].includes(s.palette))d.settings.palette=s.palette;if(['auto','light','dark'].includes(s.theme))d.settings.theme=s.theme;if(s.typographyVersion===1&&['vt323','pixelify','system','inter','plex','manrope','public'].includes(s.font))d.settings.font=s.font;for(const k of ['reactions','motion','splash'])if(typeof s[k]==='boolean')d.settings[k]=s[k];if(validMoney(s.large))d.settings.large=s.large;if(typeof raw.lastBackup==='string')d.lastBackup=raw.lastBackup;return d;}
function totals(records){return records.reduce((a,r)=>{a[r.type]+=r.amount;return a;},{income:0,expense:0});}
function savedTotal(transfers){return transfers.reduce((a,t)=>a+(t.type==='save'?t.amount:-t.amount),0);}
let data=defaults(),storageError='',rawStored=null;
function acceptStored(raw){
  rawStored=raw;
  try{data=raw===null?defaults():validateBackup(JSON.parse(raw));storageError='';return true;}
  catch(e){storageError='Não foi possível ler seus dados. Eles não serão sobrescritos automaticamente. Exporte ou recupere seu backup antes de continuar.';return false;}
}
try{acceptStored(localStorage.getItem(KEY));}catch(e){storageError='Não foi possível acessar os dados locais. Verifique o armazenamento do navegador antes de continuar.';}
let offlineStatus='preparing';let route='inicio',month=currentMonth(),filter='all',period='month',anchor=today(),toastTimer,selectedRecord=null;
function persist(next,{replace=false}={}){
  try{
    if(!replace){
      const stored=localStorage.getItem(KEY);
      if(stored!==rawStored){
        const readable=acceptStored(stored);
        if(typeof render==='function')render();
        toast(readable?'Seus dados mudaram em outra aba. Confira e tente salvar novamente.':'Os dados locais precisam ser recuperados antes de salvar.');
        return false;
      }
    }
    let clean;
    try{clean=validateBackup(next);}catch(e){toast(e.message);return false;}
    const serialized=JSON.stringify(clean);
    localStorage.setItem(KEY,serialized);data=clean;rawStored=serialized;storageError='';return true;
  }catch(e){toast('Não foi possível salvar. O armazenamento pode estar cheio ou bloqueado.');return false;}
}
function mutate(fn){if(storageError){toast('Recupere seus dados por um backup antes de registrar alterações.');return false;}const n=JSON.parse(JSON.stringify(data));fn(n);return persist(n);}
function el(tag,attrs={},...children){const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(v!==false&&v!=null)n.setAttribute(k,v===true?'':v);}for(const c of children.flat()){if(c!=null)n.append(c.nodeType?c:document.createTextNode(String(c)));}return n;}
function svgIcon(type){
  if(type==='wallet')return el('img',{src:'logo-bolso.png',class:'brand-logo',alt:'','aria-hidden':'true',width:64,height:64});
  // Original 24px sprites: one common outline, integer geometry and a candy palette.
  const ink='#49354f',lav='#cbb5ef',pink='#f3afd0',mint='#b7dfc7',blue='#a9d9ed',gold='#ffdc75',paper='#fff8ee',shade='#ad8bd3';
  const p=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  const q=(points,c)=>`<polygon points="${points}" fill="${c}"/>`;
  const box=(x,y,w,h,c)=>p(x,y,w,h,ink)+p(x+1,y+1,w-2,h-2,c);
  const coin=(x,y)=>q(`${x+2},${y} ${x+8},${y} ${x+8},${y+1} ${x+10},${y+1} ${x+10},${y+7} ${x+8},${y+7} ${x+8},${y+8} ${x+2},${y+8} ${x+2},${y+7} ${x},${y+7} ${x},${y+1} ${x+2},${y+1}`,ink)+p(x+2,y+1,6,6,gold)+p(x+1,y+2,8,4,gold)+p(x+2,y+2,5,1,'#fff2b4')+p(x+8,y+3,1,3,'#e8b74d')+p(x+4,y+3,1,2,'#e8b74d');
  let content='';
  switch(type){
    case'inicio':case'home':
      content=box(5,10,15,12,lav)+p(6,12,13,2,'#e4d3fa')+box(8,16,5,6,gold)+box(15,15,3,4,blue)+p(17,4,3,6,ink)+p(18,5,1,4,pink)+q('2,10 4,10 4,8 6,8 6,6 8,6 8,4 10,4 10,2 14,2 14,4 16,4 16,6 18,6 18,8 20,8 20,10 22,10 22,12 2,12',ink)+q('5,10 5,9 7,9 7,7 9,7 9,5 11,5 11,4 13,4 13,5 15,5 15,7 17,7 17,9 19,9 19,10',pink)+p(10,7,4,2,'#ffdaeb');break;
    case'registros':
      content=box(5,2,16,20,lav)+p(8,3,11,18,paper)+p(18,3,2,18,'#e4d3fa')+p(3,5,5,2,ink)+p(3,10,5,2,ink)+p(3,15,5,2,ink)+p(4,5,2,1,pink)+p(4,10,2,1,pink)+p(4,15,2,1,pink)+p(10,6,6,2,mint)+p(10,11,6,1,shade)+p(10,15,6,1,shade)+p(10,18,4,1,shade);break;
    case'resumo':
      content=box(3,13,5,8,mint)+box(10,8,5,13,pink)+box(17,3,5,18,lav)+p(4,14,3,2,'#ddf5e7')+p(11,9,3,2,'#ffe0ed')+p(18,4,3,2,'#e7d9ff')+p(2,21,21,1,ink);break;
    case'limites':
      content=box(2,8,20,13,lav)+p(3,9,18,3,'#e4d3fa')+p(3,16,18,4,shade)+p(8,6,11,1,ink)+p(8,3,1,5,ink)+p(9,3,8,1,ink)+p(17,4,1,4,ink)+p(9,4,8,4,paper)+box(15,13,7,5,pink)+p(17,15,2,1,ink)+p(5,14,1,2,paper)+p(6,16,2,1,paper)+p(8,14,1,2,paper);break;
    case'ajustes':
      content=q('9,2 15,2 15,5 18,5 18,7 21,7 21,10 23,10 23,15 20,15 20,18 17,18 17,21 14,21 14,23 9,23 9,20 6,20 6,18 3,18 3,15 1,15 1,10 4,10 4,7 7,7 7,5 9,5',ink)+q('10,3 14,3 14,6 17,6 17,8 20,8 20,11 22,11 22,14 19,14 19,17 16,17 16,20 13,20 13,22 10,22 10,19 7,19 7,17 4,17 4,14 2,14 2,11 5,11 5,8 8,8 8,6 10,6',lav)+box(7,8,10,10,gold)+box(9,10,6,6,blue)+p(10,11,3,2,paper);break;
    case'coins':
      content=coin(12,11)+coin(12,7)+coin(12,3)+coin(2,14)+p(3,22,17,1,'#dac5df');break;
    case'pig':
      content=q('5,9 8,9 8,6 12,6 12,8 17,8 17,10 20,10 20,12 23,12 23,17 20,17 20,19 18,19 18,22 15,22 15,20 8,20 8,22 5,22 5,18 3,18 3,11 5,11',ink)+q('5,11 8,11 8,8 11,8 11,10 17,10 17,12 20,12 20,13 22,13 22,16 19,16 19,18 17,18 17,21 16,21 16,19 7,19 7,21 6,21 6,17 4,17 4,12 5,12',pink)+p(7,12,7,2,'#ffd8e9')+p(17,12,2,2,ink)+p(20,14,1,1,'#c574a1')+p(1,11,2,4,ink)+p(2,10,2,2,ink)+p(9,9,5,1,ink)+coin(3,0);break;
    case'food':
      content=box(5,4,7,11,gold)+p(6,6,4,2,'#fff0b1')+p(7,10,3,1,'#d9a556')+p(15,5,4,9,'#f4ad84')+p(14,4,2,3,mint)+p(17,2,2,5,'#80b9a1')+p(19,4,2,3,mint)+q('2,11 22,11 22,15 20,15 20,20 18,20 18,22 6,22 6,20 4,20 4,15 2,15',ink)+q('3,12 21,12 21,14 19,14 19,19 17,19 17,21 7,21 7,19 5,19 5,14 3,14',pink)+p(3,13,18,2,'#ffd9e9')+p(8,16,1,4,paper)+p(12,16,1,4,paper)+p(16,16,1,4,paper);break;
    case'transport':
      content=p(5,2,14,1,ink)+box(3,3,18,17,blue)+p(4,4,16,2,'#d8f3ff')+box(5,7,14,7,paper)+p(11,8,1,5,ink)+p(4,15,16,1,'#78acc9')+box(5,16,4,3,gold)+box(15,16,4,3,gold)+p(5,20,3,3,ink)+p(16,20,3,3,ink)+p(1,8,2,5,ink)+p(21,8,2,5,ink);break;
    case'leisure':
      content=p(11,0,1,4,ink)+p(8,4,8,1,ink)+p(6,5,12,1,ink)+p(4,6,16,2,ink)+p(3,8,18,10,ink)+p(4,18,16,2,ink)+p(6,20,12,1,ink)+p(8,21,8,1,ink)+p(6,6,12,2,lav)+p(4,8,16,10,lav)+p(6,18,12,2,lav)+p(8,20,8,1,lav)+p(5,8,4,4,blue)+p(10,8,4,4,pink)+p(15,8,4,4,blue)+p(5,13,4,4,pink)+p(10,13,4,4,blue)+p(15,13,4,4,pink)+p(8,6,1,14,ink)+p(14,6,1,14,ink)+p(4,12,16,1,ink)+p(5,17,14,1,ink)+p(20,2,1,5,gold)+p(18,4,5,1,gold)+p(1,18,1,5,gold)+p(0,20,4,1,gold)+p(6,7,2,1,paper);break;
    case'health':
      content=box(8,2,8,6,lav)+p(10,4,4,3,paper)+box(2,7,20,15,paper)+p(3,8,18,3,'#e9e1f5')+p(3,18,18,3,'#e7dcef')+p(10,11,4,8,pink)+p(8,13,8,4,pink)+p(3,11,1,7,lav)+p(20,11,1,7,lav);break;
    case'shopping':
      content=p(8,2,8,1,ink)+p(6,3,2,5,ink)+p(16,3,2,5,ink)+p(8,3,1,4,lav)+p(15,3,1,4,lav)+box(3,7,18,15,pink)+p(4,8,16,2,'#ffdaeb')+p(18,10,2,11,'#dc8eb7')+p(5,11,1,7,paper)+p(7,18,7,1,paper)+p(7,7,2,3,ink)+p(15,7,2,3,ink);break;
    case'trash':
      content=p(9,2,6,1,ink)+p(8,3,1,3,ink)+p(15,3,1,3,ink)+p(9,3,6,2,gold)+box(5,7,14,15,pink)+p(6,8,12,2,'#ffd8e9')+p(9,11,1,8,ink)+p(14,11,1,8,ink)+box(3,5,18,3,lav);break;
    case'cry':
      content=p(7,2,10,1,ink)+p(4,3,16,2,ink)+p(2,5,20,14,ink)+p(4,19,16,2,ink)+p(7,21,10,1,ink)+p(7,3,10,17,gold)+p(4,5,16,14,gold)+p(3,7,18,10,gold)+p(6,7,3,2,ink)+p(15,7,3,2,ink)+p(7,9,2,10,blue)+p(15,9,2,10,blue)+p(7,10,1,7,paper)+p(15,10,1,7,paper)+p(10,15,4,3,ink)+p(11,16,2,1,pink);break;
    case'bill':
      content=box(4,4,16,18,paper)+p(4,4,16,5,lav)+p(7,2,2,5,ink)+p(15,2,2,5,ink)+p(7,12,10,2,pink)+p(7,16,6,2,mint)+p(14,16,3,3,gold);break;
    case'receipt':
      content=box(5,2,14,20,paper)+p(6,3,12,3,blue)+p(8,9,8,1,ink)+p(8,12,8,1,ink)+p(8,15,4,1,shade)+p(13,15,3,3,pink)+p(6,21,2,2,ink)+p(10,21,2,2,ink)+p(14,21,2,2,ink)+p(18,21,1,2,ink);break;
    case'card':
      content=box(2,5,20,15,lav)+p(3,6,18,3,'#e4d3fa')+p(3,10,18,3,ink)+box(5,15,5,3,gold)+p(14,16,5,1,paper);break;
    case'wifi':
      content=box(2,15,20,7,lav)+p(4,16,16,2,'#e4d3fa')+p(5,19,2,1,mint)+p(9,19,2,1,mint)+p(17,12,1,5,ink)+p(8,2,8,2,ink)+p(5,4,3,2,ink)+p(16,4,3,2,ink)+p(3,6,2,2,ink)+p(19,6,2,2,ink)+p(9,6,6,2,blue)+p(7,8,2,2,blue)+p(15,8,2,2,blue)+p(10,10,4,2,mint)+p(11,13,2,2,ink);break;
    case'phone':
      content=box(6,1,12,22,lav)+box(8,4,8,15,blue)+p(9,5,6,4,'#e5f6ff')+p(10,2,4,1,ink)+p(11,20,2,1,paper);break;
    case'paw':
      content=box(3,5,4,6,pink)+box(8,2,4,7,lav)+box(13,2,4,7,lav)+box(18,5,4,6,pink)+q('9,11 16,11 16,13 19,13 19,16 21,16 21,20 18,20 18,22 15,22 15,20 10,20 10,22 7,22 7,20 4,20 4,16 6,16 6,13 9,13',ink)+p(9,12,7,7,gold)+p(7,15,11,4,gold)+p(5,17,15,2,gold)+p(8,18,3,2,gold)+p(15,18,3,2,gold);break;
    case'other':default:
      content=box(3,5,18,17,lav)+p(4,6,16,4,'#e6d6fb')+p(3,10,18,1,ink)+p(9,6,6,4,pink)+p(7,14,2,2,ink)+p(11,14,2,2,ink)+p(15,14,2,2,ink);break;
  }
  const holder=document.createElement('span');holder.innerHTML=`<svg class="pixel" viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;return holder.firstChild;
}
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
function applySettings(){document.documentElement.dataset.font=data.settings.font;document.documentElement.dataset.palette=data.settings.palette;document.documentElement.dataset.theme=data.settings.theme==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):data.settings.theme;document.documentElement.classList.toggle('reduced',!data.settings.motion||matchMedia('(prefers-reduced-motion: reduce)').matches);const themeColor=document.querySelector('meta[name="theme-color"]');if(themeColor)themeColor.content=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();}
function closeDialog(){$('#dialog').close();}
function dialog(title,body,buttons=[]){const box=$('#dialog-content');$('#dialog').setAttribute('aria-labelledby','dialog-title');box.replaceChildren(el('div',{class:'dialog-heading'},el('h2',{id:'dialog-title'},title),el('button',{class:'close','aria-label':'Fechar',onclick:closeDialog},'×')),body,...buttons);$('#dialog').showModal();}
function confirmDialog(title,text,action,label='Confirmar'){dialog(title,el('p',{},text),[el('div',{class:'btn-row'},el('button',{class:'secondary',onclick:closeDialog},'Cancelar'),el('button',{class:'danger',onclick:()=>{if(action()!==false)closeDialog();}},label))]);}
function monthName(m){return new Date(m+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});}
function monthSelector(onChange=()=>render()){return el('div',{class:'month'},el('button',{'aria-label':'Mês anterior',onclick:()=>{shiftMonth(-1);onChange();}},'‹'),el('span',{},monthName(month)),el('button',{'aria-label':'Próximo mês',onclick:()=>{shiftMonth(1);onChange();}},'›'));}
function shiftMonth(n){const d=new Date(month+'-15T12:00:00');d.setMonth(d.getMonth()+n);month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function title(t,action){return el('div',{class:'heading'},el('h1',{},t),action);}
function empty(text,action){return el('div',{class:'empty'},svgIcon('wallet'),el('h2',{},'Seu mês começa aqui.'),el('p',{},text),action);}
function allBalance(){const t=totals(data.records);return t.income-t.expense-savedTotal(data.transfers);}
function categoryBarsCard(records){
  const card=el('section',{class:'card chart-card'},el('h2',{},'Gastos por categoria'));
  const expenses=records.filter(r=>r.type==='expense'),sum=expenses.reduce((a,r)=>a+r.amount,0);
  if(!sum){card.append(empty('Adicione um gasto para ver seu resumo.'));return card;}
  const groups=allCategories().map(cat=>({cat,value:expenses.filter(r=>r.category===cat[0]).reduce((a,r)=>a+r.amount,0)})).filter(g=>g.value>0).sort((a,b)=>b.value-a.value);
  const list=el('ul',{class:'category-bars','aria-label':'Gastos por categoria no mês'});
  for(const g of groups){
    const fill=el('span',{class:'category-bar-fill'});fill.style.width=`${g.value/sum*100}%`;fill.style.background=g.cat[2];
    const limit=data.limits[month+':'+g.cat[0]];
    list.append(el('li',{class:'category-bar-row'},el('div',{class:'category-bar-heading'},svgIcon(g.cat[3]||g.cat[0]),el('span',{class:'category-bar-name'},g.cat[1]),el('span',{class:'category-bar-value'},money(g.value))),el('div',{class:'category-bar-track','aria-hidden':'true'},fill),limit?el('small',{class:'category-bar-limit'},`Limite do mês: ${money(limit)}`):null));
  }
  card.append(list);return card;
}
function home(){const body=el('div',{class:'home-grid'},title('Início'),monthSelector());body.append(el('section',{class:'balance'},el('div',{},el('small',{},'Disponível no total'),el('div',{class:'amount'},money(allBalance()))),svgIcon('coins')),categoryBarsCard(data.records.filter(r=>monthOf(r.date)===month)),el('button',{class:'primary main-action',onclick:()=>recordForm()},'+ Novo registro'));return body;}
function formatDate(s){return new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'numeric',month:'short'});}
// Touch listeners stay on the stationary row, even while its card moves.
function swipeRecord(row, card, id){
  let gesture=null, suppressClickUntil=0, resetTimer;
  const clear=()=>row.classList.remove('dragging','swipe-ready','swipe-edit','swipe-delete');
  const reset=()=>{row.classList.remove('dragging');card.style.transform='';clearTimeout(resetTimer);resetTimer=setTimeout(clear,180);};
  const start=(x,y,source,pointer)=>{
    clearTimeout(resetTimer);clear();card.style.transform='';
    gesture={x,y,source,pointer,locked:false,dx:0,threshold:Math.min(72,Math.max(52,row.clientWidth*0.2))};
  };
  const move=(x,y,event)=>{
    if(!gesture)return;
    const dx=x-gesture.x,dy=y-gesture.y;
    if(!gesture.locked){
      if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;
      // Small diagonal movements stay undecided rather than cancelling the swipe.
      if(Math.abs(dy)>Math.abs(dx)*1.35){gesture=null;return;}
      if(Math.abs(dx)<Math.abs(dy)*1.15)return;
      gesture.locked=true;row.classList.add('dragging');
      if(gesture.source==='mouse')row.setPointerCapture(gesture.pointer);
    }
    if(event.cancelable)event.preventDefault();
    suppressClickUntil=Date.now()+600;gesture.dx=dx;
    const distance=Math.abs(dx),offset=distance<=96?distance:96+Math.min(24,(distance-96)*0.2);
    card.style.transform=`translate3d(${Math.sign(dx)*offset}px,0,0)`;
    row.classList.toggle('swipe-edit',dx>0);row.classList.toggle('swipe-delete',dx<0);
    row.classList.toggle('swipe-ready',distance>=gesture.threshold);
  };
  const finish=(cancelled=false)=>{
    if(!gesture)return;
    const g=gesture;gesture=null;
    if(g.locked){suppressClickUntil=Date.now()+600;if(g.source==='mouse'&&row.hasPointerCapture(g.pointer))row.releasePointerCapture(g.pointer);}
    reset();
    if(!cancelled&&g.locked&&Math.abs(g.dx)>=g.threshold){
      const record=data.records.find(r=>r.id===id);if(!record)return;
      if(g.dx>0)recordForm(record);else deleteRecord(id);
    }
  };
  row.addEventListener('click',e=>{if(Date.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
  row.addEventListener('touchstart',e=>{
    if(e.touches.length!==1){finish(true);return;}
    const t=e.touches[0];start(t.clientX,t.clientY,'touch',t.identifier);
  },{passive:true});
  row.addEventListener('touchmove',e=>{
    if(!gesture||gesture.source!=='touch')return;
    if(e.touches.length!==1){finish(true);return;}
    const t=Array.from(e.touches).find(t=>t.identifier===gesture.pointer);
    if(t)move(t.clientX,t.clientY,e);
  },{passive:false});
  row.addEventListener('touchend',e=>{
    if(!gesture||gesture.source!=='touch')return;
    const t=Array.from(e.changedTouches).find(t=>t.identifier===gesture.pointer);
    if(t){move(t.clientX,t.clientY,e);finish();}
  },{passive:false});
  row.addEventListener('touchcancel',()=>finish(true),{passive:true});
  row.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'||!e.isPrimary||e.button!==0)return;
    start(e.clientX,e.clientY,'mouse',e.pointerId);
  });
  row.addEventListener('pointermove',e=>{if(gesture?.source==='mouse'&&gesture.pointer===e.pointerId)move(e.clientX,e.clientY,e);});
  row.addEventListener('pointerup',e=>{
    if(gesture?.source!=='mouse'||gesture.pointer!==e.pointerId)return;
    move(e.clientX,e.clientY,e);finish();
  });
  for(const name of ['pointercancel','lostpointercapture'])row.addEventListener(name,e=>{if(gesture?.source==='mouse'&&gesture.pointer===e.pointerId)finish(true);});
  row.addEventListener('pointerleave',()=>{if(gesture?.source==='mouse'&&!gesture.locked)finish(true);});
}
function transaction(r){
  const card=el('button',{class:'transaction',type:'button',onclick:()=>showDetail(r.id)},el('span',{class:'icon-tile'},svgIcon(r.type==='income'?'coins':categoryIcon(r.category))),el('span',{class:'description'},el('span',{},r.note|| (r.type==='income'?'Entrada':category(r.category)[1])),el('small',{},`${formatDate(r.date)} · ${r.type==='income'?'Entrada':category(r.category)[1]}`)),el('span',{class:'value '+(r.type==='income'?'positive':'')},(r.type==='income'?'+':'−')+money(r.amount)));
  const row=el('div',{class:'swipe-record'},el('span',{class:'swipe-action swipe-action-edit','aria-hidden':'true'},svgIcon('registros'),'Editar'),el('span',{class:'swipe-action swipe-action-delete','aria-hidden':'true'},svgIcon('trash'),'Excluir'),card);
  swipeRecord(row,card,r.id);return row;
}
function deleteRecord(id){
  const r=data.records.find(r=>r.id===id);if(!r)return;
  confirmDialog('Excluir registro?',`O registro de ${money(r.amount)} será apagado.`,()=>{if(!mutate(d=>d.records=d.records.filter(x=>x.id!==id)))return false;render();toast('Registro excluído.');},'Excluir');
}
function recordsPage(){const list=data.records.filter(r=>monthOf(r.date)===month&&(filter==='all'||r.type===filter)).sort((a,b)=>b.date.localeCompare(a.date));const body=el('div',{class:'records-layout'},title('Registros',el('button',{class:'text-button',onclick:()=>recordForm()},'+ Novo')),monthSelector(),segments([['all','Todos'],['income','Entradas'],['expense','Gastos']],filter,v=>{filter=v;render();}));body.append(list.length?el('div',{class:'list'},...list.map(transaction)):empty('Nenhum registro neste período.'));return body;}
function segments(options,value,fn){return el('div',{class:'segmented'},...options.map(([id,label])=>el('button',{class:value===id?'selected':'','aria-pressed':value===id,onclick:()=>fn(id)},label)));}
function recordForm(existing){let type=existing?.type||'expense',cat=existing?.category||'food';const form=el('form',{class:'form-grid'}),amount=el('input',{class:'amount-input',inputmode:'decimal',placeholder:'0,00','aria-label':'Valor em reais',value:existing?(existing.amount/100).toFixed(2).replace('.',','):''}),date=el('input',{type:'date',required:true,value:existing?.date||today()}),note=el('textarea',{maxlength:120,placeholder:'Ex.: mercado da semana'},existing?.note||''),error=el('p',{class:'error',role:'alert'});bindMoneyMask(amount);const typeBox=el('div'),catBox=el('div');const refresh=()=>{let options=categoriesFor(type);if(existing&&type===existing.type&&cat===existing.category&&!options.some(c=>c[0]===cat))options=[category(cat),...options];if(!options.some(c=>c[0]===cat))cat=options[0][0];typeBox.replaceChildren(segments([['expense','Gasto'],['income','Entrada']],type,v=>{type=v;refresh();}));const selected=category(cat);catBox.replaceChildren(el('span',{class:'subtle'},'Categoria'),el('details',{class:'category-picker'},el('summary',{},svgIcon(categoryIcon(cat)),el('span',{},selected[1]),el('small',{},'Trocar')),el('div',{class:'categories'},...options.map(c=>el('button',{type:'button',class:'category-button '+(cat===c[0]?'selected':''),'aria-pressed':cat===c[0],onclick:()=>{cat=c[0];refresh();}},svgIcon(c[3]||c[0]),c[1]))),el('details',{class:'category-create'},el('summary',{},'+ Criar categoria'),categoryEditor(null,c=>{cat=c.id;refresh();},type,true))));typeBox.querySelectorAll('button').forEach(b=>b.type='button');};refresh();form.append(typeBox,amount,catBox,el('label',{class:'field'},'Data',date),el('label',{class:'field'},'Observação (opcional)',note),error,el('button',{class:'primary',type:'submit'},existing?'Salvar alterações':'Salvar registro'));form.addEventListener('submit',e=>{e.preventDefault();const value=parseAmount(amount.value);if(!value){error.textContent='Informe um valor válido maior que zero, como 25,90.';return;}if(!validDate(date.value)){error.textContent='Informe uma data válida.';return;}if(existing){const current=data.records.find(r=>r.id===existing.id);if(!current){error.textContent='Este registro foi excluído em outra aba. Feche esta janela para continuar.';return;}if(JSON.stringify(current)!==JSON.stringify(existing)){error.textContent='Este registro foi alterado em outra aba. Feche e abra novamente para editar a versão atual.';return;}}const record={id:existing?.id||crypto.randomUUID(),type,category:cat,amount:value,date:date.value,note:note.value.trim()};const offerLimit=shouldOfferLimit(record,!existing,data);if(mutate(d=>{const i=d.records.findIndex(r=>r.id===record.id);if(i<0)d.records.push(record);else d.records[i]=record;})){closeDialog();render();toast('Registro salvo.');if(offerLimit)firstExpenseLimitPrompt(record);else if(data.settings.reactions&&!existing&&(cat==='leisure'||(type==='expense'&&value>=data.settings.large)))showReaction(cat,value,type);}});dialog(existing?'Editar registro':'Novo registro',form);setTimeout(()=>amount.focus(),30);}
function shouldOfferLimit(record,isNew,state){
  return isNew&&record.type==='expense'&&!state.limits[monthOf(record.date)+':'+record.category]&&!state.records.some(r=>r.type==='expense'&&r.category===record.category);
}
function firstExpenseLimitPrompt(record){
  const targetMonth=monthOf(record.date),cat=category(record.category);
  const body=el('div',{class:'limit-invitation'},el('div',{class:'category-preview'},svgIcon(categoryIcon(record.category)),el('span',{},cat[1])),el('p',{},'Seu primeiro gasto nesta categoria está salvo. Quer definir um limite para acompanhar quanto pode gastar?'),el('p',{class:'subtle'},`Limite para ${monthName(targetMonth)}.`),el('div',{class:'btn-row'},el('button',{type:'button',class:'secondary',onclick:closeDialog},'Agora não'),el('button',{type:'button',class:'primary',onclick:()=>{closeDialog();month=targetMonth;navigate('limites');render();limitForm(record.category);}},'Definir limite')));
  dialog('Que tal definir um limite?',body);
}
function showReaction(cat,value,type){const large=type==='expense'&&value>=data.settings.large;const body=el('div',{class:'reaction'},svgIcon(large?'cry':'leisure'),el('h2',{},large?'Uma compra de respeito!':'Registro salvo.'),el('p',{},`${category(cat)[1]} · ${money(value)}`),el('button',{class:'primary',onclick:closeDialog},'Continuar'));dialog('Tudo registrado',body);}
function showDetail(id){const r=data.records.find(r=>r.id===id);if(!r)return;const body=el('div',{},el('div',{class:'detail-amount'},svgIcon(r.type==='income'?'coins':categoryIcon(r.category)),el('div',{class:'amount'},money(r.amount))),el('div',{class:'row'},'Tipo',r.type==='income'?'Entrada':'Gasto'),el('div',{class:'row'},'Categoria',category(r.category)[1]),el('div',{class:'row'},'Data',new Date(r.date+'T12:00:00').toLocaleDateString('pt-BR')),el('div',{class:'row'},'Observação',r.note||'—'),el('div',{class:'btn-row'},el('button',{class:'secondary',onclick:()=>{closeDialog();recordForm(r);}},'Editar'),el('button',{class:'danger',onclick:()=>{closeDialog();deleteRecord(id);}},'Excluir')));dialog('Detalhes do registro',body);}
function periodRange(){const d=new Date(anchor+'T12:00:00'),start=new Date(d),end=new Date(d);if(period==='week'){const day=(d.getDay()+6)%7;start.setDate(d.getDate()-day);end.setTime(start.getTime());end.setDate(start.getDate()+6);}else if(period==='month'){start.setDate(1);end.setMonth(end.getMonth()+1,0);}else{start.setMonth(0,1);end.setMonth(11,31);}const iso=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;return [iso(start),iso(end)];}
function changePeriod(n){const d=new Date(anchor+'T12:00:00');if(period==='week')d.setDate(d.getDate()+7*n);else if(period==='month'){d.setDate(1);d.setMonth(d.getMonth()+n);}else d.setFullYear(d.getFullYear()+n);anchor=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;render();}
function periodBars(groups,period){
  const max=Math.max(...groups,1),list=el('ul',{class:'category-bars period-bars','aria-label':'Gastos por intervalo do período'});
  const months=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],days=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
  groups.forEach((value,i)=>{
    if(!value)return;
    const label=period==='year'?months[i]:period==='week'?days[i]:`Semana ${i+1}`;
    const fill=el('span',{class:'category-bar-fill'});fill.style.width=`${value/max*100}%`;fill.style.background='var(--mint)';
    list.append(el('li',{class:'category-bar-row'},el('div',{class:'category-bar-heading'},el('span',{class:'category-bar-name'},label),el('span',{class:'category-bar-value'},money(value))),el('div',{class:'category-bar-track','aria-hidden':'true'},fill)));
  });
  return list;
}
function summary(){const [start,end]=periodRange(),records=data.records.filter(r=>r.date>=start&&r.date<=end),t=totals(records),savedInPeriod=data.transfers.filter(t=>t.type==='save'&&t.date>=start&&t.date<=end).reduce((sum,t)=>sum+t.amount,0),body=el('div',{},title('Resumo'),segments([['week','Semana'],['month','Mês'],['year','Ano']],period,v=>{period=v;render();}),el('div',{class:'month'},el('button',{'aria-label':'Período anterior',onclick:()=>changePeriod(-1)},'‹'),el('span',{},period==='month'?monthName(start.slice(0,7)):period==='year'?start.slice(0,4):`${formatDate(start)} – ${formatDate(end)}`),el('button',{'aria-label':'Próximo período',onclick:()=>changePeriod(1)},'›')));const totalCard=el('section',{class:'card summary-card'},el('div',{class:'row'},'Entradas',el('span',{class:'value positive'},money(t.income))),el('div',{class:'row'},'Gastos',el('span',{class:'value'},money(t.expense))),el('div',{class:'row'},el('span',{},'Cofrinho'),el('span',{class:'value positive'},money(savedTotal(data.transfers)>0?savedInPeriod:0))),el('div',{class:'row'},'Saldo do período',el('span',{class:'value'},money(t.income-t.expense))));const groups=Array.from({length:period==='year'?12:period==='week'?7:Math.ceil(Number(end.slice(8))/7)},()=>0);for(const r of records.filter(r=>r.type==='expense')){const idx=period==='year'?Number(r.date.slice(5,7))-1:period==='week'?Math.round((new Date(r.date+'T12:00:00')-new Date(start+'T12:00:00'))/86400000):Math.floor((Number(r.date.slice(8))-1)/7);groups[idx]+=r.amount;}const bars=periodBars(groups,period);const chart=el('section',{class:'card summary-card'},el('h2',{},'Gastos no período'),t.expense?bars:el('p',{class:'notice'},'Ainda não há gastos neste período.'));body.append(el('div',{class:'summary-grid'},totalCard,chart),el('button',{class:'saving-link',onclick:()=>navigate('guardado')},svgIcon('pig'),el('span',{},'Cofrinho · Total guardado',el('strong',{},money(savedTotal(data.transfers)))),el('span',{},'›')));return body;}
function savings(){const body=el('div',{class:'settings-layout'},back('resumo'),title('Dinheiro guardado'),el('div',{class:'saving-total'},svgIcon('pig'),el('p',{class:'subtle'},'Total guardado'),el('div',{class:'amount'},money(savedTotal(data.transfers)))),el('div',{class:'btn-row'},el('button',{class:'secondary',onclick:()=>transferForm('save')},'Guardar dinheiro'),el('button',{class:'primary',onclick:()=>transferForm('withdraw')},'Retirar dinheiro')),el('p',{class:'notice'},'Mova dinheiro entre o disponível e o guardado. Isso não conta como entrada ou gasto.'),el('h2',{},'Movimentações'));if(!data.transfers.length)body.append(el('p',{class:'notice'},'Quando você guardar dinheiro, os movimentos aparecem aqui.'));for(const t of [...data.transfers].reverse())body.append(el('div',{class:'row'},el('span',{},t.type==='save'?'Guardou':'Retirou',el('small',{class:'subtle'},` · ${formatDate(t.date)}`),t.note?el('p',{class:'subtle'},t.note):null),money(t.amount)));return body;}
function transferForm(type){const amount=el('input',{class:'amount-input',inputmode:'decimal',placeholder:'0,00','aria-label':'Valor em reais'}),date=el('input',{type:'date',required:true,value:today()}),note=el('textarea',{maxlength:120,placeholder:'Ex.: reserva, viagem…'}),error=el('p',{class:'error',role:'alert'}),preview=el('p',{class:'notice'},'O total do seu dinheiro continua igual.'),form=el('form',{class:'form-grid'},amount,el('label',{class:'field'},'Data',date),el('label',{class:'field'},'Observação (opcional)',note),preview,error,el('button',{class:'primary',type:'submit'},type==='save'?'Guardar dinheiro':'Retirar dinheiro'));bindMoneyMask(amount);form.addEventListener('submit',e=>{e.preventDefault();const value=parseAmount(amount.value);if(!value){error.textContent='Informe um valor válido maior que zero.';return;}if(!validDate(date.value)){error.textContent='Informe uma data válida.';return;}if(type==='withdraw'&&value>savedTotal(data.transfers)){error.textContent='O valor é maior que o total guardado.';return;}if(type==='save'&&value>allBalance()){error.textContent='O valor é maior que o saldo disponível. Registre suas entradas primeiro.';return;}if(mutate(d=>d.transfers.push({id:crypto.randomUUID(),type,amount:value,date:date.value,note:note.value.trim()}))){closeDialog();render();toast(`${money(value)} ${type==='save'?'movidos para o dinheiro guardado.':'devolvidos ao saldo disponível.'}`);}});dialog(type==='save'?'Guardar dinheiro':'Retirar dinheiro',form);}
function limits(){const body=el('div',{class:'records-layout'},title('Limites'),monthSelector());const entries=categoriesFor('expense').filter(c=>data.limits[month+':'+c[0]]);if(!entries.length)body.append(empty('Defina limites por categoria para acompanhar seus gastos.'));for(const c of entries){const limit=data.limits[month+':'+c[0]],spent=data.records.filter(r=>r.type==='expense'&&monthOf(r.date)===month&&r.category===c[0]).reduce((a,r)=>a+r.amount,0),pct=Math.round(spent/limit*100);const fill=el('span');fill.style.width=`${Math.min(100,pct)}%`;fill.style.background=c[2];body.append(el('section',{class:'card limit-item'},el('div',{class:'limit-head'},el('span',{class:'icon-tile'},svgIcon(c[3]||c[0])),el('div',{class:'info'},el('h3',{},c[1]),el('small',{},`${money(spent)} de ${money(limit)}`)),el('button',{class:'text-button',onclick:()=>limitForm(c[0])},'Editar')),el('div',{class:'progress'},fill),el('div',{class:'limit-caption'},el('span',{},spent>limit?`${money(spent-limit)} acima do limite`:`${money(limit-spent)} restantes`),`${pct}%`)));}body.append(el('button',{class:'primary main-action',onclick:()=>limitForm()},'+ Definir limite'));return body;}
function limitForm(cat='food'){const existing=data.limits[month+':'+cat],select=el('select',{},...categoriesFor('expense').map(c=>el('option',{value:c[0],selected:c[0]===cat},c[1]))),amount=el('input',{class:'amount-input',inputmode:'decimal',placeholder:'0,00',value:existing?(existing/100).toFixed(2).replace('.',','):''}),error=el('p',{class:'error',role:'alert'});bindMoneyMask(amount);const form=el('form',{class:'form-grid'},el('label',{class:'field'},'Categoria',select),el('label',{class:'field'},'Limite mensal em reais',amount),el('p',{class:'subtle'},`Vale para ${monthName(month)}.`),error,el('button',{class:'primary',type:'submit'},'Salvar limite'));select.addEventListener('change',()=>{const v=data.limits[month+':'+select.value];amount.value=v?formatMoneyDigits(String(v)):'';});if(existing)form.append(el('button',{class:'danger',type:'button',onclick:()=>{closeDialog();confirmDialog('Remover limite?','Os registros da categoria serão mantidos.',()=>{if(!mutate(d=>delete d.limits[month+':'+select.value]))return false;render();},'Remover');}},'Remover limite'));form.addEventListener('submit',e=>{e.preventDefault();const value=parseAmount(amount.value);if(!value){error.textContent='Informe um limite válido maior que zero.';return;}if(mutate(d=>d.limits[month+':'+select.value]=value)){closeDialog();render();toast('Limite salvo.');}});dialog(existing?'Editar limite':'Definir limite',form);}
function settings(){const palettes=[['candy','Candy',['#f6bbdf','#dfcdf6','#c8efd7']],['peach','Pêssego',['#ffbfb7','#f9d7c4','#e2edc9']],['ocean','Oceano',['#a9dff1','#b8e9df','#dac5f5']],['garden','Jardim',['#c0e2c7','#d8e5ca','#f6e5a4']]],body=el('div',{class:'settings-layout'},title('Ajustes'),el('section',{class:'settings-section'},el('h2',{},'Aparência'),segments([['light','Claro'],['dark','Escuro'],['auto','Automático']],data.settings.theme,v=>setting('theme',v))));const colors=el('section',{class:'settings-section'},el('h2',{},'Paleta de cores'));for(const [id,name,values] of palettes){const dots=el('span',{class:'palette-dots'});values.forEach(v=>{const dot=el('i');dot.style.background=v;dots.append(dot);});const preview=el('span',{class:'palette-preview','data-preview-palette':id},dots);colors.append(el('button',{class:'palette-row '+(data.settings.palette===id?'selected':''),'aria-pressed':data.settings.palette===id,onclick:()=>setting('palette',id)},preview,name,el('span',{class:'check'},data.settings.palette===id?'✓':'')));}const fontSelect=el('select',{'aria-label':'Fonte do aplicativo',onchange:e=>setting('font',e.target.value)});for(const [id,name] of [['vt323','VT323 — pixel legível (padrão)'],['pixelify','Pixelify Sans — pixel suave'],['system','Atual do aparelho'],['inter','Inter — discreta'],['plex','IBM Plex Sans — personalidade'],['manrope','Manrope — acolhedora'],['public','Public Sans — direta']])fontSelect.append(el('option',{value:id,selected:data.settings.font===id},name));const fontSection=el('section',{class:'settings-section font-settings'},el('h2',{},'Fonte'),el('label',{class:'field'},'Escolha sua fonte',fontSelect),el('p',{class:'font-sample'},'Seu saldo do mês — R$ 2.450,00'));body.append(colors,fontSection,...[['categories','Categorias','other'],['preferences','Ícones e animações','ajustes'],['backup','Dados e backup','registros'],['install','Instalar no iPhone','inicio']].map(([id,label,icon])=>el('button',{class:'settings-link',onclick:()=>navigate(id)},svgIcon(icon),el('span',{},label),'›')),el('p',{class:'notice'},'Seus dados ficam neste navegador. Sem conta e sem conexão com o banco.'));return body;}
function categoryEditor(existing,onSave,initialType='expense',lockedType=false){
  let categoryType=existing?.type||initialType;
  const typeSelect=el('select',{'aria-label':'Tipo da categoria'},el('option',{value:'expense'},'Gasto'),el('option',{value:'income'},'Entrada'));typeSelect.value=categoryType;typeSelect.addEventListener('change',()=>{categoryType=typeSelect.value;});
  let icon=existing?.icon||'other',color=existing?.color||categoryColors[0];
  const name=el('input',{type:'text',maxlength:30,placeholder:'Ex.: Academia',value:existing?.name||'',autocomplete:'off'}),error=el('p',{class:'error',role:'alert'}),icons=el('div',{class:'category-icon-options',role:'group','aria-label':'Ícone da categoria'}),colors=el('div',{class:'category-color-options',role:'group','aria-label':'Cor da categoria'}),preview=el('div',{class:'category-preview','aria-hidden':'true'});
  const refresh=()=>{
    preview.replaceChildren(svgIcon(icon),el('span',{},name.value.trim()||'Sua categoria'));preview.style.borderColor=color;
    icons.replaceChildren(...categoryIcons.map(([id,label])=>el('button',{type:'button',class:'category-icon-option','aria-label':label,'aria-pressed':id===icon,onclick:()=>{icon=id;refresh();}},svgIcon(id))));
    colors.replaceChildren(...categoryColors.map((value,i)=>el('button',{type:'button',class:'category-color-option',style:'--swatch:'+value,'aria-label':['Rosa','Lilás','Azul','Menta','Amarelo','Pêssego','Lavanda azul','Damasco'][i],'aria-pressed':value===color,onclick:()=>{color=value;refresh();}},value===color?'✓':'')));
  };
  name.addEventListener('input',()=>{preview.lastChild.textContent=name.value.trim()||'Sua categoria';});
  const save=()=>{
    const label=name.value.trim();if(!label){error.textContent='Dê um nome para sua categoria.';name.focus();return;}
    if(categoriesFor(categoryType).some(c=>c[0]!==existing?.id&&categoryNameKey(c[1])===categoryNameKey(label))){error.textContent='Já existe uma categoria com esse nome.';return;}
    if(existing&&JSON.stringify(data.categories.find(c=>c.id===existing.id))!==JSON.stringify(existing)){error.textContent='Esta categoria mudou em outra aba. Abra novamente para editar.';return;}
    if(existing&&categoryType!==(existing.type||'expense')&&(data.records.some(r=>r.category===existing.id)||Object.keys(data.limits).some(k=>k.endsWith(':'+existing.id)))){error.textContent='Esta categoria tem registros ou limites. Crie outra categoria para usar um tipo diferente.';return;}
    const next={id:existing?.id||'custom-'+crypto.randomUUID(),name:label,color,icon,type:categoryType};
    if(mutate(d=>{const i=d.categories.findIndex(c=>c.id===next.id);if(i<0)d.categories.push(next);else d.categories[i]=next;})){onSave(next);toast(existing?'Categoria atualizada.':'Categoria criada.');}
  };
  name.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save();}});
  const body=el('div',{class:'category-editor'},lockedType?el('p',{class:'subtle'},categoryType==='income'?'Categoria de entrada':'Categoria de gasto'):el('label',{class:'field'},'Tipo',typeSelect),el('label',{class:'field'},'Nome',name),preview,el('span',{class:'subtle'},'Escolha um ícone'),icons,el('span',{class:'subtle'},'Escolha uma cor'),colors,error,el('button',{type:'button',class:'secondary',onclick:save},existing?'Salvar categoria':'Criar categoria'));
  refresh();return body;
}
function categoriesPage(){
  const body=el('div',{class:'settings-layout'},back(),title('Categorias',el('button',{class:'text-button',onclick:()=>dialog('Nova categoria',categoryEditor(null,()=>{closeDialog();render();}))},'+ Criar')));
  body.append(el('p',{class:'notice'},'Crie categorias com a sua cara. Elas aparecem nos registros, barras e limites.'));
  const custom=el('div',{class:'category-manage-list'});
  if(!data.categories.length)custom.append(el('p',{class:'notice'},'Suas categorias personalizadas aparecerão aqui.'));
  for(const c of data.categories){
    const edit=()=>dialog('Editar categoria',categoryEditor(c,()=>{closeDialog();render();}),[el('button',{class:'danger',style:'margin-top:12px',onclick:()=>{
      if(data.records.some(r=>r.category===c.id)||Object.keys(data.limits).some(k=>k.endsWith(':'+c.id))){toast('Esta categoria tem registros ou limites. Troque a categoria deles antes de excluir.');return;}
      confirmDialog('Excluir categoria?',`A categoria “${c.name}” será removida.`,()=>{if(data.records.some(r=>r.category===c.id)||Object.keys(data.limits).some(k=>k.endsWith(':'+c.id))){toast('Esta categoria passou a ter registros ou limites.');return false;}if(!mutate(d=>d.categories=d.categories.filter(x=>x.id!==c.id)))return false;render();toast('Categoria excluída.');},'Excluir');
    }},'Excluir categoria')]);
    custom.append(el('button',{class:'category-manage-row',onclick:edit},svgIcon(c.icon),el('span',{},c.name),el('small',{},(c.type==='income'?'Entrada':'Gasto')+' · Editar')));
  }
  body.append(el('h2',{class:'category-section-title'},'Personalizadas'),custom,el('h2',{class:'category-section-title'},'Gastos'),el('div',{class:'category-manage-list'},...cats.map(c=>el('div',{class:'category-manage-row'},svgIcon(c[3]||c[0]),el('span',{},c[1])))),el('h2',{class:'category-section-title'},'Entradas'),el('div',{class:'category-manage-list'},...incomeCats.map(c=>el('div',{class:'category-manage-row'},svgIcon(c[3]),el('span',{},c[1])))));
  return body;
}
function setting(key,value){if(mutate(d=>d.settings[key]=value)){applySettings();render();}}
function back(to='ajustes'){return el('button',{class:'back',onclick:()=>navigate(to)},'‹ Voltar');}
function preferences(){const body=el('div',{class:'settings-layout'},back(),title('Ícones e animações'));for(const [key,label] of [['reactions','Reações divertidas'],['splash','Animação de abertura'],['motion','Animações no app']]){const input=el('input',{type:'checkbox',checked:data.settings[key],'aria-label':label,onchange:e=>setting(key,e.target.checked)});body.append(el('label',{class:'toggle'},label,input));}const amount=el('input',{inputmode:'decimal',value:(data.settings.large/100).toFixed(2).replace('.',',')}),error=el('p',{class:'error'});bindMoneyMask(amount);body.append(el('label',{class:'field',style:'margin-top:22px'},'Considerar gasto grande a partir de (R$)',amount),el('p',{class:'notice'},'Você escolhe quando a carinha aparece. As reações não mudam seus registros.'),error,el('button',{class:'primary',onclick:()=>{const value=parseAmount(amount.value);if(!value){error.textContent='Informe um valor válido maior que zero.';return;}setting('large',value);toast('Preferências salvas.');}},'Salvar preferências'),el('p',{class:'notice'},'A preferência de reduzir movimento do aparelho é respeitada automaticamente.'));return body;}
function exportBackup(){if(!storageError){try{const latest=localStorage.getItem(KEY);if(latest!==rawStored){const readable=acceptStored(latest);render();if(!readable){toast('Os dados locais precisam ser recuperados. Use a opção de baixar os dados originais.');return;}}}catch(e){toast('Não foi possível acessar os dados locais para exportação.');return;}}if(storageError){if(!rawStored){toast('Não foi possível acessar os dados locais para exportação.');return;}const url=URL.createObjectURL(new Blob([rawStored],{type:'text/plain'})),link=el('a',{href:url,download:'bolso-recuperacao-original.txt'});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Arquivo original preparado para recuperação. Ele ainda precisa ser verificado.');return;}const next=JSON.parse(JSON.stringify(data));next.lastBackup=new Date().toISOString();const blob=new Blob([JSON.stringify(next,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a',{href:url,download:`bolso-backup-${today()}.json`});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);if(!storageError)persist(next);render();toast('Arquivo de backup preparado. Salve-o em um lugar seguro.');}
function backup(){const input=el('input',{type:'file',accept:'.json,application/json',id:'file-input'});input.addEventListener('change',async()=>{const file=input.files[0];if(!file)return;if(file.size>20*1024*1024){toast('O arquivo é muito grande. Use um backup de até 20 MB.');return;}try{const imported=validateBackup(JSON.parse(await file.text()));const body=el('div',{},el('p',{},file.name),el('div',{class:'row'},'Registros',String(imported.records.length)),el('div',{class:'row'},'Categorias personalizadas',String(imported.categories.length)),el('div',{class:'row'},'Limites',String(Object.keys(imported.limits).length)),el('div',{class:'row'},'Movimentos guardados',String(imported.transfers.length)),el('p',{class:'warning'},'Este backup substituirá todos os registros, limites, movimentos e preferências atuais.'),el('p',{class:'notice'},'Exporte uma cópia antes de continuar.'),el('div',{class:'btn-row'},el('button',{class:'secondary',onclick:closeDialog},'Cancelar'),el('button',{class:'danger',onclick:()=>{if(persist(imported,{replace:true})){applySettings();closeDialog();render();toast('Backup importado.');}}},'Substituir e importar')));dialog('Importar backup',body);}catch(e){toast(e instanceof SyntaxError?'Não foi possível ler o JSON deste arquivo.':e.message);}});return el('div',{class:'settings-layout'},back(),title('Dados e backup'),el('div',{class:'saving-total'},svgIcon('registros')),el('p',{},'Seus registros ficam neste aparelho.'),el('p',{class:'notice'},'Guarde uma cópia antes de trocar de celular ou limpar os dados do navegador.'),el('button',{class:'secondary',onclick:exportBackup},storageError?'Baixar dados originais para recuperação':'Exportar backup'),el('button',{class:'primary',style:'margin-top:12px',onclick:()=>input.click()},'Importar backup'),input,el('p',{class:'notice'},data.lastBackup?`Último arquivo preparado: ${new Date(data.lastBackup).toLocaleString('pt-BR')}`:'Último backup: ainda não criado.'));}
function install(){return el('div',{class:'settings-layout'},back(),title('Instalar no iPhone'),el('div',{class:'intro'},el('p',{},'Tenha o Bolso na sua Tela de Início.'),el('p',{class:'notice',role:'status'},offlineStatus==='ready'?'✓ Pronto para usar sem internet neste navegador.':offlineStatus==='failed'?'O modo off-line ainda não está pronto. Abra novamente com internet para tentar.':'Preparando o modo off-line…'),...['Abra este link no Safari.','Toque no botão Compartilhar.','Escolha “Adicionar à Tela de Início” e confirme.'].map((s,i)=>el('div',{class:'install-step'},el('b',{},String(i+1)),s)),el('p',{class:'notice'},'Depois do primeiro carregamento completo, o app funciona sem internet. Seus dados continuam neste aparelho.'),el('p',{class:'notice'},'No Android, use “Instalar aplicativo” no menu do navegador.')));}
function navigate(id){location.hash=id;}
function render(){applySettings();route=location.hash.slice(1)||'inicio';const pages={inicio:home,registros:recordsPage,resumo:summary,limites:limits,ajustes:settings,guardado:savings,categories:categoriesPage,preferences,backup,install};if(!pages[route])route='inicio';$('#main').replaceChildren(...(storageError?[el('p',{class:'warning',role:'alert'},storageError)]:[]),pages[route]());const active=['guardado'].includes(route)?'resumo':['categories','preferences','backup','install'].includes(route)?'ajustes':route;$('#nav').replaceChildren(...[['inicio','Início'],['registros','Registros'],['resumo','Resumo'],['limites','Limites'],['ajustes','Ajustes']].map(([id,label])=>el('a',{href:'#'+id,class:active===id?'active':'','aria-current':active===id?'page':null},svgIcon(id),el('span',{},label))));}
window.addEventListener('hashchange',()=>{render();window.scrollTo({top:0});});window.addEventListener('storage',e=>{if((e.key!==KEY&&e.key!==null)||(e.storageArea&&e.storageArea!==localStorage))return;const readable=acceptStored(e.newValue);render();toast(readable?'Dados atualizados em outra aba.':'Não foi possível ler a atualização de outra aba. Recupere os dados antes de continuar.');});matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applySettings);matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',applySettings);$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=$('#dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
$('#brand-icon').append(svgIcon('wallet'));$('#splash-icon').append(svgIcon('wallet'));render();setTimeout(()=>$('#splash').classList.add('hidden'),data.settings.splash&&data.settings.motion&&!matchMedia('(prefers-reduced-motion: reduce)').matches?750:0);
if('serviceWorker'in navigator){const hadController=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!hadController||document.getElementById('update-notice'))return;document.body.append(el('aside',{id:'update-notice',role:'status'},el('span',{},'Uma nova versão está pronta. Seus registros estão preservados.'),el('button',{class:'secondary',type:'button',onclick:()=>location.reload()},'Atualizar agora')));});navigator.serviceWorker.register('sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{document.documentElement.dataset.offlineReady='true';offlineStatus='ready';if(route==='install')render();}).catch(()=>{offlineStatus='failed';if(route==='install')render();});}
window.BolsoTest=Object.freeze({parseAmount,validateBackup,totals,savedTotal,validDate});
if(!('serviceWorker' in navigator))offlineStatus='failed';