const util = require('util');

module.exports = function(root, requireModule) {
  function inspect(val) {
    return util.inspect(val, { depth: 5, colors: true, showHidden: true });
  }

  function toString(args) {
    var parts = [];
    for (var i = 0, il = args.length; i < il; i++) {
      var val = args[i],
          isString = (typeof val === 'string' || val instanceof String),
          strVal = (isString) ? val : inspect(val);

      parts.push(strVal);
    }

    return parts.join(' ');
  }

  function error(...args) {
    console.error(toString(args));
  }

  function warn(...args) {
    console.warn(toString(args));
  }

  function info(...args) {
    console.log(toString(args));
  }

  function debug(...args) {
    console.log(toString(args));
  }

  Object.assign(root, {
    error,
    warn,
    info,
    debug
  });
};
