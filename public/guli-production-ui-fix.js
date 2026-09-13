// Small production UI fixes: preserve banner dimensions while restoring overlay visibility and admin input interaction.
(function(){if(window.__GULI_UI_FIX_V2__)return;window.__GULI_UI_FIX_V2__=true;const css=`
.loginAura,.loginGlow,.proLogin .loginAura{pointer-events:none!important;z-index:0!important}
.proLogin,.proLoginCard,.loginCard{position:relative!important}
.proLoginCard,.loginCard{z-index:200!important;isolation:isolate!important;pointer-events:auto!important}
.proLoginCard input,.loginCard input,.proLoginCard textarea,.loginCard textarea,.proLoginCard select,.loginCard select{position:relative!important;z-index:300!important;pointer-events:auto!important;touch-action:manipulation!important;user-select:text!important;-webkit-user-select:text!important;-webkit-touch-callout:default!important;caret-color:#201b20!important}
.hero{position:relative!important;isolation:isolate!important;overflow:hidden!important}
.heroSlideItem{position:relative!important;isolation:isolate!important}
.heroSlideItem>img{position:relative!important;z-index:1!important;display:block!important}
.heroOverlay{position:absolute!important;z-index:20!important;min-height:100%!important;box-sizing:border-box!important;overflow:visible!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}
.heroOverlay *{visibility:visible!important;opacity:1!important;position:relative!important;z-index:21!important}
.heroOverlay h1,.heroOverlay h2{display:block!important;color:#fff!important;text-shadow:0 2px 12px rgba(0,0,0,.55)!important}
.heroOverlay p{display:block!important;color:#fff!important;text-shadow:0 1px 8px rgba(0,0,0,.5)!important}
.heroOverlay button,.heroOverlay a{display:inline-flex!important;align-items:center!important;justify-content:center!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;position:relative!important;z-index:30!important;min-height:42px!important;padding:10px 18px!important;border-radius:12px!important;background:#fff!important;color:#b6536b!important;border:0!important;box-shadow:0 8px 24px rgba(0,0,0,.2)!important;font-weight:800!important;text-decoration:none!important}
@media(max-width:480px){.heroOverlay{padding-top:18px!important;padding-bottom:22px!important}.heroOverlay h1,.heroOverlay h2{font-size:clamp(25px,7.5vw,32px)!important;line-height:1.08!important;margin-bottom:10px!important}.heroOverlay button,.heroOverlay a{display:inline-flex!important}}
`;const s=document.createElement('style');s.id='guli-production-ui-fix';s.textContent=css;document.head.appendChild(s)})();
