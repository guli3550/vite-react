(() => {
  const params = new URLSearchParams(location.search);
  const ref = (params.get('product') || '').trim();
  if (!ref) return;
  let opened = false;
  const findAndOpen = () => {
    if (opened) return;
    const cards = [...document.querySelectorAll('article.productCard')];
    const card = cards.find(el => (el.textContent || '').includes(`Kod: ${ref}`));
    if (card) {
      opened = true;
      card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return;
    }
    const catalogButton = [...document.querySelectorAll('nav.bottomNav button')].find(btn => (btn.textContent || '').includes('Katalog'));
    if (catalogButton && !document.querySelector('.pageHeader h1')?.textContent?.includes('Katalog')) {
      catalogButton.click();
    }
  };
  const observer = new MutationObserver(findAndOpen);
  observer.observe(document.body, { childList: true, subtree: true });
  findAndOpen();
  setTimeout(findAndOpen, 500);
  setTimeout(findAndOpen, 1200);
  setTimeout(findAndOpen, 2500);
})();
