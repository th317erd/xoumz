module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe, getProp, setProp } = requireModule('./utils');
  const { ContentType } = requireModule('./content-type/content-type');

  class HTTPResponse {
    constructor(body, _opts) {
      var opts = _opts || {};

      if (!(body instanceof ContentType))
        throw new Error('HTTPResponse data must be an instance of ContentType');

      definePropertyRW(this, 'options', opts);
      definePropertyRO(this, 'body', body);
      definePropertyRW(this, 'headers', Object.assign({}, opts.headers || {}));
      definePropertyRW(this, 'statusCode', opts.statusCode || 200);
    }

    getHeader(name) {
      return getProp(this, `headers.${name}`);
    }

    setHeader(name, value) {
      if (!noe(name))
        return;

      setProp(this, `headers.${name}`, value);
    }

    status(statusCode) {
      this.statusCode = statusCode;
    }
  }

  Object.assign(root, {
    HTTPResponse
  });
};
