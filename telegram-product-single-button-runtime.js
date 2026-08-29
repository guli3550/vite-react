(() => {
  // Keep Telegram product announcements to one canonical CTA.
  // This runtime removes legacy purchase/browser buttons from rendered messages.
  const REMOVE_TEXT = /^(?:🤩\s*)?(?:sotib\s*olish|buy\s*now|browser|🌐\s*browser\s*\+\s*chat)$/i;
  const REMOVE_URL = /(?:vite-react-seven-inky-10\.vercel\.app|guli-lingerie-web\.onrender\.com).*?(?:tgapp=|product=)/i;

  function clean(root = document) {
    const nodes = root.querySelectorAll?.('a,button') || [];
    nodes.forEach(node => {
      const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
      const href = String(node.getAttribute?.('href') || '').trim();
      if (REMOVE_TEXT.test(text) || (href && REMOVE_URL.test(href) && /(?:sotib|buy|browser)/i.test(text))) {
        node.remove();
      }
    });
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) clean(node);
      });
    }
  });

  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  clean();
})();
