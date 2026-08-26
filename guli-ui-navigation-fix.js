(() => {
  const names=['Pinyuar','Pijama','Byustgalter','Trusik','Mayku'];
  const categoryTarget={Pinyuar:'Uy kiyimlari',Pijama:'Uy kiyimlari',Byustgalter:'Byustgalter',Trusik:'Trusik',Mayku:'Uy kiyimlari'};
  const scan=()=>{const sc=document.querySelector('.categoryScroll');if(!sc)return;[...sc.querySelectorAll('.categoryCard')].slice(0,5).forEach((card,i)=>{const name=names[i];if(!name)return;card.onclick=e=>{e.preventDefault();e.stopPropagation();const targetName=categoryTarget[name];const tabs=[...document.querySelectorAll('.categoryTabs .tab')];const target=tabs.find(x=>String(x.textContent).trim().toLowerCase()===String(targetName).toLowerCase());if(target)target.click();const catalog=[...document.querySelectorAll('.bottomNav button')][1];if(catalog)catalog.click()}})};
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});setTimeout(scan,700);setInterval(scan,1800);
})();
