module.exports = function(root, requireModule) {
  const { ModelBase } = requireModule('./models/model-base');
  const sessionSchema = requireModule('./models/schemas/session');

  class Session extends ModelBase {
    static schema(...args) {
      return sessionSchema.call(this, ...args);
    }
  }

  root.export({
    Session
  });
};
