module.exports = function(root, requireModule) {
  return function(self, types) {
    return {
      'validAt': types.Date.notNull.required
    };
  };
};
