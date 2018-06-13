module.exports = function(root, requireModule) {
  const { definePropertyRW, noe, regExpEscape } = requireModule('./base/utils');
  const { EngineBase } = requireModule('./base/engine-base');
  const { Context } = requireModule('./base/context');

  const RouteEngine = this.defineClass((EngineBase) => {
    return class RouteEngine extends EngineBase {
      static name() {
        return 'route';
      }

      static configKeyName() {
        return 'routes';
      }

      constructor(_opts) {
        super(_opts);

        var opts = _opts || {};

        definePropertyRW(this, '_options', opts);
        definePropertyRW(this, '_routes', []);
      }

      getContext(...args) {
        return new Context({ name: 'route', group: 'engine' }, ...args);
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

      generateCRUDRoutesFromSchema(_prefix) {
        var prefix = _prefix,
            app = this.getApplication(),
            schemaEngine = app.getSchemaEngine({ operation: 'routes' });

        if (!schemaEngine)
          return;

        if (!prefix)
          prefix = '';

        schemaEngine.iterateModelSchemas((typeInfo, typeName) => {
          if (typeInfo.primitiveType)
            return;

          var modelType = typeInfo.modelType;
          this.registerRoute((Route) => {
            var matchingRE = new RegExp(`^${regExpEscape(prefix)}/(${regExpEscape(typeName.toLowerCase())})(?:/(.*))?`, 'i');
            return class SchemaGeneratedCRUDRoute extends Route {
              static match(url, request) {
                return ('' + url.pathname).match(matchingRE);
              }

              getModelType() {
                return modelType;
              }
            };
          }, app.CRUDRoute);
        }, true);
      }
    };
  }, EngineBase);

  root.export({
    RouteEngine
  });
};
