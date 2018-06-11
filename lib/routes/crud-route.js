module.exports = function(root, requireModule) {
  const { instanceOf } = requireModule('./base/utils');
  const { Route } = requireModule('./routes/route');
  const { ContentTypeJSON } = requireModule('./content-type/content-type-json');

  const CRUDRoute = this.defineClass((Route) => {
    return class CRUDRoute extends Route {
      constructor(_opts) {
        super(_opts);

        console.log('Creating crud route!');
      }

      static match(url, request) {
        return false;
      }

      getRequestParameters() {
        var matchArgs = this.constructor.match(this.request.url, this.request.clientRequest),
            params = {
              id: matchArgs && matchArgs[2]
            },
            queryParams = super.getRequestParameters();

        return Object.assign(params, queryParams);
      }

      getModelType() {
        throw new Error('CRUD route doesn\'t provide a "getModelType" method');
      }

      async onCreate({ id }, body) {
        var modelType = this.getModelType(),
            application = this.getApplication();

        try {
          var model = modelType.instantiate(body || {}, { validate: true }),
              errors = [],
              results = await application.save(model);

          for (var i = 0, il = results.length; i < il; i++) {
            var result = results[i];
            if (!result.success)
              errors = errors.concat(result.errors);
          }

          if (errors.length)
            return this.renderErrorResponse(errors, 400);

          return this.renderResponse({
            errors: [],
            success: true,
            body: model
          }, 201);
        } catch (e) {
          console.error('There was an error!', e);
          return this.renderErrorResponse(e, 201);
        }
      }

      async onRetrieve({ id }, body) {
        var modelType = this.getModelType();
        return this.renderResponse(`GET Hello from model handler: ${modelType.getTypeName()} = ${id}`);
      }

      async onUpdate({ id }) {

      }

      async onDelete({ id }) {

      }

      async execute({ method, params, body }) {
        if (!instanceOf(body, ContentTypeJSON))
          this.throwError(400);

        var bodyData = body.data;

        if (method === 'post')
          return await this.onCreate(params, bodyData);
        else if (method === 'get')
          return await this.onRetrieve(params, bodyData);
        else if (method === 'put')
          return await this.onUpdate(params, bodyData);
        else if (method === 'delete')
          return await this.onDelete(params, bodyData);
      }
    };
  }, Route);

  root.export({
    CRUDRoute
  });
};
