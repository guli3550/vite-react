/* GULI canonical server boundary.
 * This module is intentionally small: it does not implement business logic.
 * It makes the canonical API origin explicit and exposes diagnostics so the
 * edge can verify that requests reached the intended backend process.
 */
const express = require("express");

const CANONICAL_SERVER_NAME = "guli-canonical-api";
const CANONICAL_SERVER_VERSION = process.env.GULI_SERVER_VERSION || "2026.09.16";

if (!globalThis.__GULI_CANONICAL_SERVER_BOUNDARY__) {
  globalThis.__GULI_CANONICAL_SERVER_BOUNDARY__ = true;

  const originalUse = express.application.use;
  express.application.use = function guliCanonicalBoundaryUse(...args) {
    return originalUse.apply(this, args);
  };

  const originalListen = express.application.listen;
  express.application.listen = function guliCanonicalListen(...args) {
    this.use((req, res, next) => {
      res.setHeader("X-GULI-Server", CANONICAL_SERVER_NAME);
      res.setHeader("X-GULI-Server-Version", CANONICAL_SERVER_VERSION);
      next();
    });
    return originalListen.apply(this, args);
  };

  console.log(`[GULI] canonical server boundary active: ${CANONICAL_SERVER_NAME} ${CANONICAL_SERVER_VERSION}`);
}
