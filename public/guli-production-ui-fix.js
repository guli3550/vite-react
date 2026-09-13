// Small mobile production UI fixes; intentionally does not change design dimensions.
(function(){if(window.__GULI_UI_FIX_V1__)return;window.__GULI_UI_FIX_V1__=true;const css=`
.loginAura,.loginGlow,.proLogin .loginAura{pointer-events:none!important}
.proLoginCard,.loginCard{position:relative!important;z-index:20!important}
.proLogin input,.loginCard input{position:relative!important;z-index:30!important;pointer-events:auto!important;touch-action:manipulation!important;user-select:text!important;-webkit-user-select:text!important;-webkit-touch-callout:default!important}
.hero,.heroOverlay{position:relative!important}.hero{overflow:hidden!important}.heroOverlay{z-index:5!important;min-height:100%!important;box-sizing:border-box!important;padding-bottom:clamp(18px,5vw,32px)!important;overflow:visible!important;justify-content:flex-end!important}.heroOverlay h1,.heroOverlay h2,.heroOverlay p,.heroOverlay button,.heroOverlay a{position:relative!important;z-index:6!important;visibility:visible!important;opacity:1!important}.heroOverlay button,.heroOverlay a{pointer-events:auto!important}
@media(max-width:480px){.heroOverlay{padding-top:18px!important;padding-bottom:22px!important}.heroOverlay h1{font-size:clamp(25px,7.5vw,32px)!important;line-height:1.08!important;margin-bottom:10px!important}.heroOverlay button,.heroOverlay a{display:inline-flex!important;visibility:visible!important}}
`;const s=document.createElement('style');s.id='guli-production-ui-fix';s.textContent=css;document.head.appendChild(s)})();
