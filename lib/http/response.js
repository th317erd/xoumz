module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe, getProp, setProp, instanceOf } = requireModule('./base/utils');
  const { ContentType } = requireModule('./content-type/content-type');

  const HTTPResponse = this.defineClass((ParentClass) => {
    return class HTTPResponse extends ParentClass {
      constructor(body, _opts) {
        var opts = _opts || {};

        if (!instanceOf(body, ContentType))
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
    };
  });

  root.export({
    HTTPResponse
  });
};
