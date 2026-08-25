(() => {
  const scan = () => {
    document.querySelectorAll('.empty').forEach(box => {
      if (box.dataset.retryReady) return;
      const title = box.querySelector('h3')?.textContent || '';
      const text = box.textContent || '';
      if (!/xatolik|ochilmadi|yuklashda/i.test(title + text)) return;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'guli-catalog-retry'; btn.textContent = 'Qayta yuklash';
      btn.onclick = () => location.reload(); box.appendChild(btn); box.dataset.retryReady = '1';
    });
    document.querySelectorAll('.menuRow').forEach(row => {
      if (row.dataset.shareReady) return;
      const title = row.querySelector('b')?.textContent || '';
      if (!/ulashish/i.test(title)) return;
      row.dataset.shareReady = '1';
      row.addEventListener('click', async () => {
        const text = 'GULI Premium — nafis va zamonaviy ayollar mahsulotlari';
        const url = location.origin + location.pathname;
        try {
          const tg = window.Telegram?.WebApp;
          if (tg?.switchInlineQuery) { tg.switchInlineQuery(text, ['users','groups','channels']); return; }
          if (navigator.share) { await navigator.share({title:'GULI Premium',text,url}); return; }
          if (navigator.clipboard) { await navigator.clipboard.writeText(`${text} ${url}`); const small=row.querySelector('small'); if(small) small.textContent='Havola nusxalandi ✓'; }
        } catch {}
      });
    });
  };
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  setTimeout(scan,300); setTimeout(scan,1000); setTimeout(scan,2000);
})();
