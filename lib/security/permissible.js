module.exports = function(root, requireModule) {
  const { instanceOf } = requireModule('./base/utils');
  const { LazyCollection } = requireModule('./base/collections');

  const PERMISSION_LEVEL = {
    NONE: 0x00,
    READ: 0x01,
    WRITE: 0x02,
    EXECUTE: 0x04
  };

  PERMISSION_LEVEL.FULL = PERMISSION_LEVEL.READ | PERMISSION_LEVEL.WRITE | PERMISSION_LEVEL.EXECUTE;

  class Permissible {
    async getRoles() {
      if (instanceOf(this.roles, 'array', LazyCollection))
        return this.roles;

      return new LazyCollection();
    }

    async getRole(roleName) {
      return await this.getRoles().where({ value: roleName });
    }

    async hasRole(roleName) {
      return !!(await this.getRole(roleName));
    }

    async getPermissionLevel(accessor) {
      return 0;
    }

    isPermissibleType(accessor) {
      return (instanceOf(accessor, Permissible));
    }

    permissableType() {
      return 'base';
    }

    isPermissableType(...args) {
      var thisType = this.permissableType();
      for (var i = 0, il = args.length; i < il; i++) {
        if (args[i] === thisType)
          return true;
      }

      return false;
    }

    accessLevelDefault() {
      return 0;
    }

    accessLevelNone() {
      return 0;
    }

    accessLevelRead() {
      return PERMISSION_LEVEL.READ;
    }

    accessLevelWrite() {
      return PERMISSION_LEVEL.WRITE;
    }

    accessLevelExecute() {
      return PERMISSION_LEVEL.EXECUTE;
    }

    accessLevelFull() {
      return PERMISSION_LEVEL.FULL;
    }
  }

  Object.assign(Permissible, {
    PERMISSION_LEVEL
  });

  root.export({
    PERMISSION_LEVEL,
    Permissible
  });
};
