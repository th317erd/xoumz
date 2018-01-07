module.exports = function(root, requireModule) {
  const { definePropertyRW, noe } = requireModule('./utils');
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
          routeClass = routeFunc.call(this, BaseRouteClass);

      if (!(routeClass instanceof Function))
        throw new Error('registerRoute callback function must return a class that inherits from Route');

      this._routes.push(routeClass);
    }

    selectRouteFromURL(url, request) {
      var routes = this._routes;

      for (var i = 0, il = routes.length; i < il; i++) {
        var routeClass = routes[i];
        if (!routeClass)
          continue;

        var value = routeClass.match(url, request);
        if (value === false || noe(value))
          continue;

        return routeClass;
      }
    }
  }

  Object.assign(root, {
    RouteEngine
  });
};
