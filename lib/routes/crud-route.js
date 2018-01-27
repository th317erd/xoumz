module.exports = function(root, requireModule) {
  const { Route } = requireModule('./routes/route');

  class CRUDRoute extends Route {
    constructor(_opts) {
      super(_opts);
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
      var modelType = this.getModelType();
      return this.renderResponse(`POST Hello from model handler: ${modelType.getTypeName()} = ${id}\n\nBODY: ${JSON.stringify(body)}`, 201);
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
      if (method === 'post')
        return await this.onCreate(params, body);
      else if (method === 'get')
        return await this.onRetrieve(params, body);
      else if (method === 'put')
        return await this.onUpdate(params, body);
      else if (method === 'delete')
        return await this.onDelete(params, body);
    }
  }

  Object.assign(root, {
    CRUDRoute
  });
};
