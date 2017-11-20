
(function(root) {
  function error(...args) {
    console.error(...args);
  }

  function warn(...args) {
    console.warn(...args);
  }

  function info(...args) {
    console.log(...args);
  }

  function debug(...args) {
    console.log(...args);
  }

  Object.assign(root, {
    error,
    warn,
    info,
    debug
  });
})(module.exports);
