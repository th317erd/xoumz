module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');
  const { Route } = requireModule('./routes/route');
  const Logger = requireModule('./logger');

  class RouteEngine {
    static createInstance(Klass, opts) {
      return new Klass(opts);
    }

    constructor(_opts) {
      var opts = _opts || {};

      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, '_routes', []);
    }

    async onInit() {
    }

    getRouteBaseClass() {
      return this.getApplication().Route;
    }

    registerRoute(routeFunc, _baseClass) {
      var baseClass = _baseClass || this.getRouteBaseClass(),
          BaseRouteClass = this.getApplication().wrapClass(baseClass),
          route = routeFunc.call(this, BaseRouteClass);

      if (!(route instanceof Function))
        throw new Error('registerRoute callback function must return a class that inherits from Route');

      route = new route();
      if (!(route instanceof Route))
        throw new Error('registerRoute callback function must return a valid route');

      this._routes.push(route);
    }

    selectRouteFromURL(url, request) {
      var routes = this._routes;

      for (var i = 0, il = routes.length; i < il; i++) {
        var route = routes[i];
        if (!route)
          continue;

        if (!route.match(url, request))
          continue;

        return route;
      }
    }
  }

  Object.assign(root, {
    RouteEngine
  });
};
