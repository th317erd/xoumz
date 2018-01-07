module.exports = function(root, requireModule) {
  const { definePropertyRW, getProp } = requireModule('./utils');
  const { Permissible } = requireModule('./security/permissible');
  const Logger = requireModule('./logger');

  var routeOrder = 0;

  class Route extends Permissible {
    constructor(_opts) {
      super(_opts);

      var opts = Object.assign({
        order: routeOrder++
      }, _opts || {});

      var request = {
        clientRequest: opts.request,
        url: opts.url,
        body: opts.body
      };

      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, 'request', request);

      request.method = request.clientRequest && ('' + request.clientRequest.method).toLowerCase();
      request.params = this.getRequestParameters();
      request.body = this.getRequestBody();
    }

    static match(url, request) {

    }

    getRequestParameters() {
      var params = {},
          searchParams = getProp(this, 'request.url.searchParams');

      if (!searchParams)
        return {};

      for (const [name, value] of searchParams)
        params[name] = value;

      return params;
    }

    getRequestBody() {
      var body = this.request.body,
          clientRequest = this.request.clientRequest;

      if (!body || !clientRequest)
        return { type: 'none', body: null };

      if (body.type === 'buffer' && clientRequest.headers['content-type'].match(/application\/json/i)) {
        try {
          body.body = JSON.parse(body.body.toString());
          body.type = 'json';
        } catch (e) {}
      }

      return body;
    }
  }

  Object.assign(root, {
    Route
  });
};
