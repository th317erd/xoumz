module.exports = function(root, requireModule) {
  const { definePropertyRO, definePropertyRW, noe } = requireModule('./utils');

  const PERMISSION = {
    READ: 0x01,
    WRITE: 0x02,
    EXECUTE: 0x04
  };

  PERMISSION.FULL = PERMISSION.READ | PERMISSION.WRITE | PERMISSION.EXECUTE;

  class Role {
    constructor(flags, order, name = 'anonymous') {
      definePropertyRO(this, 'flags', flags || 0);
      definePropertyRO(this, 'order', order || 0);
      definePropertyRO(this, 'name', name);
    }
  }

  class PermissionEngine {
    constructor(_opts) {
      var opts = _opts || {};

      definePropertyRW(this, 'options', opts);
      definePropertyRW(this, '_roles', {});

      if (opts.ownerRole !== false) {
        this.registerRole('owner', (opts.ownerRole instanceof Function) ? opts.ownerRole : (primary, target) => {
          if (noe(primary))
            return new Role(0, 0, 'owner');

          var ol = primary.calculateOwnerGeneration(target),
              weight = (ol) ? (1 / ol) : 0,
              flags = 0;

          if (weight >= 1)
            flags = PERMISSION.FULL;
          else if (weight >= 0)
            flags = PERMISSION.READ;

          return new Role(flags, 100, 'owner');
        });
      }
    }

    registerRole(name, getter) {
      this._roles[name] = getter;
    }

    getSchemaEngine() {
      return this.getApplication().getSchemaEngine();
    }

    getRootRole() {
      // Default is deny all
      return new Role(0, -1, 'root');
    }

    getRolePermissionLevel(roleName, primary, target) {
      if (noe(primary))
        return new Role(0, 0, roleName);

      var getterFunc = this._roles[roleName];
      if (!(getterFunc instanceof Function) && primary.getRolePermissionLevel instanceof Function)
        getterFunc = primary.getRolePermissionLevel.bind(primary);

      if (!(getterFunc instanceof Function)) {
        var primaryHasRole = false,
            targetHasRole = false;

        if (primary.hasRole instanceof Function)
          primaryHasRole = primary.hasRole();

        if (target && target.hasRole instanceof Function)
          targetHasRole = target.hasRole();

        return (targetHasRole && !primaryHasRole) ? new Role(0, 1, roleName) : new Role(PERMISSION.FULL, 1, roleName);
      }

      var role = getterFunc.call(this, primary, target);
      if (!(role instanceof Role))
        return new Role(0, 0, roleName);

      return role;
    }

    getPermissionLevel(primary, target) {
      if (noe(primary))
        return new Role(0, 0);

      var primaryRoles = primary.getRoles(),
          targetRoles = (target && target !== primary && target.getRoles instanceof Function) ? target.getRoles() : [],
          alreadyVisited = {},
          roles = primaryRoles.concat(targetRoles).reduce((arr, roleName) => {
            if (alreadyVisited[roleName])
              return arr;

            alreadyVisited[roleName] = true;

            arr.push(this.getRolePermissionLevel(roleName, primary, target));
            return arr;
          }, [this.getRootRole()]),
          permissionLevel = 0xFF;

      roles = roles.sort((a, b) => {
        var x = a.order,
            y = b.order;

        return (x == y) ? 0 : (x < y) ? -1 : 1;
      });

      for (var i = 0, il = roles.length; i < il; i++) {
        var role = roles[i];
        permissionLevel &= role.flags;
      }

      return permissionLevel;
    }
  }

  // Static properties
  Object.assign(Role, {
    PERMISSION
  });

  Object.assign(root, {
    Role,
    PermissionEngine
  });
};
