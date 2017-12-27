const Application = require('./application');

(function(root) {
  Object.assign(root, Application, {});
})(module.exports);
