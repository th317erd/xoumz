module.exports = function(root, requireModule) {
  const { definePropertyRW, definePropertyRO } = requireModule('./base/utils');

  const PERMISSION = {
    READ: 0x01,
    WRITE: 0x02,
    EXECUTE: 0x04
  };

  PERMISSION.FULL = PERMISSION.READ | PERMISSION.WRITE | PERMISSION.EXECUTE;

  class Role {
    constructor(flags, order, name = 'anonymous') {
      definePropertyRO(this, 'flags', flags || 0);
      definePropertyRO(this, 'name', name);
    }
  }

  // Static properties
  Object.assign(Role, {
    PERMISSION
  });

  class Permissible {
    constructor(_opts) {
      var opts = _opts || {};

      definePropertyRW(this, '_options', opts);
      definePropertyRW(this, '_roles', []);
    }

    getRoles() {
      return (this._roles || []);
    }

    getRole(roleName) {
      return this.getRoles().filter((name) => (name === roleName))[0];
    }

    hasRole(roleName) {
      return !!this.getRole(roleName);
    }

    getPermissionLevel(target) {
      return this.getApplication().getEngine('permission', { target }).getPermissionLevel(this, target);
    }
  }

  root.export({
    Permissible
  });
};
