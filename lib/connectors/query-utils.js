module.exports = function(root, requireModule) {
  const { definePropertyRW, noe } = requireModule('./utils');
  
  class QueryParam {
    constructor(typeName, _opts) {
      var opts = _opts || {};

      definePropertyRW(this, 'type', typeName);
      definePropertyRW(this, 'field', opts.field);
      definePropertyRW(this, 'value', opts.value);
      definePropertyRW(this, 'args', opts.args || []);
    }
  }

  function newQueryParamType(context, name) {
    var typeName = name.toUpperCase(),
        Klass = class GenericQueryParam extends QueryParam {
          constructor(opts) {
            super(typeName, opts);
          }
        };

    context[typeName] = function(...args) {
      return new Klass({
        value: args[0],
        args: args.slice(1)
      });
    };

    return Klass;
  }

  function iterateQueryParams(modelType, params, cb, _opts) {
    if (noe(params))
      return;

    var opts = _opts || {},
        keys = Object.keys(params),
        parts = [],
        abort = () => abort;

    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i],
          param = params[key];
      
      if (!(param instanceof QueryParam)) {
        param = new QueryParam('EQ', {
          field: key,
          value: param
        });
      }

      var ret = cb.call(this, param, key, modelType, opts, abort);
      if (ret === abort)
        break;

      parts.push(ret);
    }

    return parts;
  }

  function paramsToRawObject(params) {
    if (noe(params))
      return {};

    var keys = Object.keys(params),
        obj = {};

    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i],
          param = params[key];
      
      if (param instanceof QueryParam)
        obj[key] = param.value;
      else
        obj[key] = param;
    }

    return obj;
  }

  newQueryParamType(root, 'EQ');
  newQueryParamType(root, 'CONTAINS');
  newQueryParamType(root, 'RANGE');
  newQueryParamType(root, 'ONE_OF');

  Object.assign(root, {
    iterateQueryParams,
    paramsToRawObject,
    QueryParam
  });
};
