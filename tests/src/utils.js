const util = require('util');

(function(root) {
  function inspect(val) {
    return util.inspect(val, { depth: 5, colors: true, showHidden: true });
  }

  Object.assign(root, {
    inspect
  });
})(module.exports);
