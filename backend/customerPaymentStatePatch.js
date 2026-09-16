// Compatibility shim only.
// Payment state and receipt-preview routes are owned by paymentConfirmationRuntime.js.
// Keeping a second registration here caused route-stack collisions and could make
// two handlers compete for the same response. Canonical customer identity remains
// server-verified in the active payment runtime.
module.exports = {};
