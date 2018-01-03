module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');
  const { Route } = requireModule('./routes/route');
  const Logger = requireModule('./logger');

  class CRUDRoute extends Route {
    constructor(_opts) {
      super(_opts);
    }
  }

  Object.assign(root, {
    CRUDRoute
  });
};
