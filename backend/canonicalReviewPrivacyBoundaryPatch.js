// Public review privacy boundary.
// A review may be public, but the customer's order number is not a public identifier.
const { registry } = require('./routeRegistry.js');

function sanitize(value) {
  if (!value || typeof value !== 'object') return value;
  const clone = Array.isArray(value) ? value.map(sanitize) : { ...value };
  if (Array.isArray(clone?.data?.reviews)) {
    clone.data = { ...clone.data, reviews: clone.data.reviews.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const clean = { ...row };
      delete clean.order_number;
      return clean;
    }) };
  }
  return clone;
}

for (const route of registry.routes) {
  if (route.__canonicalReviewPrivacyBoundary || route.method !== 'get' || route.path !== '/api/reviews') continue;
  route.handlers = route.handlers.map((handler) => async function canonicalReviewPrivacy(req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = (body) => originalJson(sanitize(body));
    return handler(req, res, next);
  });
  route.__canonicalReviewPrivacyBoundary = true;
}

console.log('[CanonicalReviewPrivacyBoundary] public review payload no longer exposes order numbers');
