module.exports = function(root, requireModule) {
  const { definePropertyRW, getProp, instanceOf, noe } = requireModule('./base/utils');
  const { getMimeType } = requireModule('./base/mime-types');
  const { Permissible } = requireModule('./security/permissible');
  const { ContentTypeText, ContentTypeJSON, ContentTypeFile, ContentTypeStream } = requireModule('./content-type');
  const { HTTPResponse } = requireModule('./http/response');
  const { statusCodeToMessage } = requireModule('./http/http-engine');

  var routeOrder = 0;

  function getRenderResponseOptions(_statusCode, _opts) {
    var statusCodeIsOptions = instanceOf(_statusCode, 'object'),
        statusCode = (statusCodeIsOptions) ? 200 : _statusCode,
        options = (statusCodeIsOptions) ? _statusCode : (_opts || {});

    return Object.assign({ statusCode }, options);
  }

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

    async execute() {

    }

    throwError(statusCode, _message) {
      var message = _message;
      if (message instanceof Error)
        message = message.message;

      var error = new Error(message);
      error.statusCode = statusCode;

      throw error;
    }

    renderResponse(data, _statusCode, _opts) {
      function getContentTypeFromData(data, options) {
        if (instanceOf(data, 'stream'))
          return new ContentTypeStream(data, options);
        else if (instanceOf(data, 'object'))
          return new ContentTypeJSON(data, options);
        else
          return new ContentTypeText(('' + data), options);
      }

      var options = getRenderResponseOptions(_statusCode, _opts);
      return new HTTPResponse(getContentTypeFromData(data, options), options);
    }

    renderErrorResponse(_errors, _statusCode) {
      var statusCode = _statusCode || 500,
          errors = (noe(_errors)) ? statusCodeToMessage(_statusCode) : _errors;

      if (errors instanceof Error)
        errors = errors.message;

      if (!(errors instanceof Array))
        errors = [errors];

      return this.renderResponse({
        errors,
        success: false
      }, statusCode);
    }

    renderTextResponse(data, _statusCode, _opts) {
      var options = getRenderResponseOptions(_statusCode, _opts);
      return new HTTPResponse(new ContentTypeText(data, options), options);
    }

    renderJSONResponse(data, _statusCode, _opts) {
      var options = getRenderResponseOptions(_statusCode, _opts);
      return new HTTPResponse(new ContentTypeJSON(data, options), options);
    }

    renderFileResponse(filePath, _statusCode, _opts) {
      var options = getRenderResponseOptions(_statusCode, _opts);
      options = Object.assign({ filePath, encoding: 'utf8', mimeType: getMimeType(filePath) }, options);

      return new HTTPResponse(new ContentTypeFile(undefined, options), options);
    }

    renderStreamResponse(data, _statusCode, _opts) {
      var options = getRenderResponseOptions(_statusCode, _opts);
      return new HTTPResponse(new ContentTypeStream(data, options), options);
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
      return this.request.body;
    }
  }

  Object.assign(root, {
    Route
  });
};
