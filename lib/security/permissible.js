module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe } = requireModule('./utils');

  class Permissible {
    constructor(_opts) {
      var opts = _opts || {};

      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, 'roles', []);
    }

    getRoles() {
      return (this.roles || []);
    }

    getRole(roleName) {
      return this.getRoles().filter((name) => (name === roleName))[0];
    }

    hasRole(roleName) {
      return !!this.getRole(roleName);
    }

    getPermissionLevel(target) {
      return this.getApplication().getPermissionEngine().getPermissionLevel(this, target);
    }
  }

  Object.assign(root, {
    Permissible
  });
};
