module.exports = function(root, requireModule) {
  const sessionSchema = requireModule('./models/schemas/session');

  function sessionModelCreator(ModelBase) {
    return class Session extends ModelBase {
      static schema(...args) {
        return sessionSchema.call(this, ...args);
      }
    };
  }

  Object.assign(root, {
    Session: sessionModelCreator
  });
};
