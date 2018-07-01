module.exports = function(root, requireModule) {
  const { ModelBase } = requireModule('./models/model-base');
  const sessionSchema = requireModule('./models/schemas/session');

  const Session = this.defineClass((ModelBase) => {
    return class Session extends ModelBase {
      static schema(...args) {
        return sessionSchema.call(this, ...args);
      }

      static getUniqueResourceID() {
        return 'org_xoumz_model_Session';
      }
    };
  }, ModelBase);

  root.export({
    Session
  });
};
