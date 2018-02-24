const path = require('path'),
      { MD5 } = require('crypto-js');

// Shim object to have values / keys / entries if they don't exist
(function() {
  if (!Object.prototype.hasOwnProperty('keys')) {
    Object.defineProperty(Object.prototype, 'keys', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: function*() {
        var keys = Object.keys(this);
        for (var i = 0, il = keys.length; i < il; i++)
          yield keys[i];
      }
    });
  }

  if (!Object.prototype.hasOwnProperty('values')) {
    Object.defineProperty(Object.prototype, 'values', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: function*() {
        var keys = Object.keys(this);
        for (var i = 0, il = keys.length; i < il; i++)
          yield this[keys[i]];
      }
    });
  }

  if (!Object.prototype.hasOwnProperty('entries')) {
    Object.defineProperty(Object.prototype, 'entries', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: function*() {
        var keys = Object.keys(this);
        for (var i = 0, il = keys.length; i < il; i++) {
          var key = keys[i],
              value = this[key];

          yield [ key, value ];
        }
      }
    });
  }
})();

class ApplicationModule {
  constructor(application, moduleName) {
    function getModuleName(thisModulePath) {
      var startIndex = thisModulePath.indexOf(__dirname);
      return (startIndex < 0) ? thisModulePath : thisModulePath.substring(__dirname.length).replace(/^[\\\/]+/g, '').replace(/\.js$/i, '');
    }

    if (!application)
      throw new Error('Application module must have an application reference');

    Object.defineProperty(this, '_application', {
      writable: false,
      enumerable: false,
      configurable: false,
      value: application
    });

    Object.defineProperty(this, 'moduleName', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: getModuleName(moduleName)
    });
  }

  getApplication() {
    return this._application;
  }

  export(...groups) {
    for (var i = 0, il = groups.length; i < il; i++) {
      var group = groups[i];

      if (group instanceof Array || !(group.entries instanceof Function))
        continue;

      for (var [ key, value ] of group.entries()) {
        if (value instanceof Function && ('' + value.name).match(/^[A-Z]/))
          value = this._application.wrapClass(value);

        this[key] = value;
      }
    }
  }
}

(function(root) {
  function requireModule(name) {
    function requireByPath(name) {
      var thisModule, moduleID, tryRequire = [
        (moduleName) => {
          if (!moduleName.match(/^xoumz:\/\//))
            return;

          return require(path.resolve(__dirname, '..', moduleName.replace(/^xoumz:\/\//, './')));
        },
        (moduleName) => require(moduleName),
        (moduleName) => {
          if (moduleName.charAt(0) !== '.')
            return;

          return require(path.resolve(__dirname, '..', moduleName));
        },
        (moduleName) => require.main.require(moduleName)
      ];

      for (var i = 0, il = tryRequire.length; i < il; i++) {
        try {
          thisModule = tryRequire[i](name);
          if (!thisModule)
            continue;

          moduleID = MD5(thisModule.toString()).toString();
          break;
        } catch (e) {
          if (!e.message.match(/^Cannot find module/))
            console.error(e);
        }
      }

      if (!thisModule)
        throw new Error(`Unable to find module: ${name}`);

      if (moduleCache[moduleID])
        return moduleCache[moduleID];

      var moduleRoot = thisModule;
      if (thisModule instanceof Function && (name.match(/^(\.|xoumz:\/\/)/) || (thisModule.xoumzPluginName && (typeof thisModule.xoumzPluginName === 'string' || thisModule.xoumzPluginName instanceof String)))) {
        moduleRoot = new ApplicationModule(application, thisModule.xoumzPluginName || name);

        var newRoot = thisModule.call(application, moduleRoot, application.requireModule, moduleRoot.moduleName, moduleID);
        if (newRoot !== undefined)
          moduleRoot = newRoot;
      }

      moduleCache[moduleID] = moduleRoot;

      return moduleRoot;
    }

    function requireRaw(thisModule) {
      var moduleID = MD5(thisModule.toString()).toString();
      if (moduleCache[moduleID])
        return moduleCache[moduleID];

      if (thisModule instanceof Function && thisModule.xoumzPluginName && (typeof thisModule.xoumzPluginName === 'string' || thisModule.xoumzPluginName instanceof String)) {
        var moduleRoot = {},
            newRoot = name.call(application, moduleRoot, application.requireModule, thisModule.xoumzPluginName);

        if (newRoot !== undefined)
          moduleRoot = newRoot;

        moduleCache[thisModule.xoumzPluginName] = moduleRoot;

        return moduleRoot;
      } else {
        return name;
      }
    }

    var opts = this,
        application = opts.application,
        moduleCache = application._modules,
        thisModule = (typeof name === 'string' || name instanceof String) ? requireByPath(name) : requireRaw(name);

    return thisModule;
  }

  Object.assign(root, {
    requireModule
  });
})(module.exports);
