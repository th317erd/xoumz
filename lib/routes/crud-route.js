module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');
  const { Route } = requireModule('./routes/route');
  const Logger = requireModule('./logger');

  class CRUDRoute extends Route {
    constructor(_opts) {
      super(_opts);
    }

    match(url, request) {
      return false;
    }

    async onCreate() {}
    async onRetrieve() {}
    async onUpdate() {}
    async onDelete() {}

    async execute(url, request) {
      var method = ('' + request.method);

      if (method.match(/^post$/i))
        return await this.onCreate(url, request);
      else if (method.match(/^get$/i))
        return await this.onRetrieve(url, request);
      else if (method.match(/^put$/i))
        return await this.onUpdate(url, request);
      else if (method.match(/^delete$/i))
        return await this.onDelete(url, request);
    }
  }

  Object.assign(root, {
    CRUDRoute
  });
};
