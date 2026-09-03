const express = require('express');

const registry = globalThis.__GULI_ROUTE_REGISTRY__ || (globalThis.__GULI_ROUTE_REGISTRY__ = {
  routes: [],
  attach(app) {
    if (!app) return;
    if (!app.__guliMountedRoutes) app.__guliMountedRoutes = new Set();
    for (const r of registry.routes) {
      const key = `${r.method}:${r.path}`;
      if (!app.__guliMountedRoutes.has(key)) {
        app.__guliMountedRoutes.add(key);
        if (typeof app[r.method] === 'function') {
          app[r.method](r.path, ...r.handlers);
        }
      }
    }
  }
});

if (!globalThis.__GULI_HOOKED_EXPRESS__) {
  globalThis.__GULI_HOOKED_EXPRESS__ = true;
  const origListen = express.application.listen;
  express.application.listen = function(...args) {
    registry.attach(this);
    return origListen.apply(this, args);
  };
  const origHandle = express.application.handle;
  if (origHandle) {
    express.application.handle = function(...args) {
      registry.attach(this);
      return origHandle.apply(this, args);
    };
  }
}

function install(method, path, ...handlers) {
  const original = express.application[method];
  if (original) {
    express.application[method] = function(routePath, ...args) {
      if (routePath === path) return original.call(this, routePath, ...handlers, ...args);
      return original.call(this, routePath, ...args);
    };
  }
  registry.routes.push({ method, path, handlers });
}

module.exports = { install, registry };
