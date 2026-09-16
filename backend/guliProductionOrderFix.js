// Compatibility shim during canonical-server consolidation.
// The legacy customer order/receipt handlers in this file were previously
// disabled because they accepted client-supplied identity/order references.
// Admin status/payment-decision routes are now owned by the explicit integrity
// guard + atomic payment decision modules and the canonical index handlers.
// Keeping this file startup-safe avoids breaking older deployment references.
module.exports = {};
