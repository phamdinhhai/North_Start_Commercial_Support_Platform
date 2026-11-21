const view=document.querySelector('#health');
const show=response=>{view.textContent=JSON.stringify(response,null,2);};
for(const kind of ['start','stop','upload','disconnect'])document.querySelector('#'+kind).addEventListener('click',async()=>show(await chrome.runtime.sendMessage({kind})));
document.querySelector('#configure').addEventListener('click',async()=>{
 try{const origin=new URL(document.querySelector('#origin').value).origin;
 if(!await chrome.permissions.request({origins:[origin+'/*']}))throw Error('permission denied');
 const enrollment=JSON.parse(document.querySelector('#enrollment').value);
 show(await chrome.runtime.sendMessage({kind:'configure',origin,enrollment}));document.querySelector('#enrollment').value='';
 }catch{show({ok:false,code:'CONFIGURATION_REFUSED'});}
});
document.querySelector('#diagnostic').addEventListener('click',async()=>{
 if(!await chrome.permissions.request({permissions:['debugger']}))return show({ok:false,code:'DIAGNOSTIC_PERMISSION_DENIED'});
 show(await chrome.runtime.sendMessage({kind:'diagnostic'}));
});
show(await chrome.runtime.sendMessage({kind:'status'}));
