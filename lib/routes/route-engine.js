module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');
  const { Route } = requireModule('./routes/route');
  const Logger = requireModule('./logger');

  class RouteEngine {
    constructor(_opts) {
      super(_opts);
    }

    async onInit() {
    }
  }

  Object.assign(root, {
    RouteEngine
  });
};
