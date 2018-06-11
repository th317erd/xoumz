module.exports = function(root, requireModule) {
  const { ModelBase } = requireModule('./models/model-base');
  const sessionSchema = requireModule('./models/schemas/session');

  const Session = this.defineClass((ModelBase) => {
    return class Session extends ModelBase {
      static schema(...args) {
        return sessionSchema.call(this, ...args);
      }
    };
  }, ModelBase);

  root.export({
    Session
  });
};
