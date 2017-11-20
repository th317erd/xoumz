import { definePropertyRW } from '../utils';

(function(root) {
  class QueryParam {
    constructor(typeName, ...args) {
      definePropertyRW(this, 'type', typeName);
      definePropertyRW(this, 'value', args);
    }
  }

  function newQueryParamType(context, name) {
    var typeName = name.toUpperCase(),
        Klass = class GenericQueryParam extends QueryParam {
          constructor(...args) {
            super(typeName, ...args);
          }
        };

    context[typeName] = function(...args) {
      return new GenericQueryParam();
    };

    return Klass;
  }

  function iterateQueryParams(schemaType, params, cb, _opts) {
    if (noe(params))
      return;

    var opts = _opts || {},
        keys = Object.keys(params),
        parts = [];

    for (var i = 0, il = keys.length; i < il; i++) {
      var key = keys[i],
          param = params[key];
      
      parts.push(cb.call(this, param, key, schemaType, opts));
    }

    return parts;
  }

  newQueryParamType(root, 'EQ');
  newQueryParamType(root, 'CONTAINS');
  newQueryParamType(root, 'RANGE');
  newQueryParamType(root, 'ONE_OF');

  Object.assign(root, {
    QueryParam,
  });
})(module.exports);
