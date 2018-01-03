module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');
  const { Permissible } = requireModule('./security/permissible');
  const Logger = requireModule('./logger');

  var routeOrder = 0;

  class Route extends Permissible {
    constructor(_opts) {
      super(_opts);

      var opts = Object.assign({
        order: routeOrder++
      }, _opts || {});

      definePropertyRW(this, 'options', opts);
    }

    match(path, request) {

    }
  }

  Object.assign(root, {
    Route
  });
};
