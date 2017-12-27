const { User } = require('./user'),
      { Dependent } = require('./dependent');

(function(root) {
  Object.assign(root, {
    User,
    Dependent
  });
})(module.exports);
