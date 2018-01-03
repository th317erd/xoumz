module.exports = function(root, requireModule) {
  const Route = requireModule('./routes/route');
  const CRUDRoute = requireModule('./routes/crud-route');
  const RouteEngine = requireModule('./routes/route-engine');

  Object.assign(root, Route, CRUDRoute, RouteEngine, {
  });
};
