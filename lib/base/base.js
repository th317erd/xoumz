const path = require('path');

// Shim object to have values / keys / entries (if they don't already exist)
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

  if (!Object.prototype.hasOwnProperty(Symbol.iterator)) {
    Object.defineProperty(Object.prototype, Symbol.iterator, {
      writable: true,
      enumerable: false,
      configurable: true,
      value: function*() {
        yield* Object.prototype.entries.call(this);
      }
    });
  }
})();

// This holds information about a loaded module
class ApplicationModule {
  constructor(application, moduleName, modulePath, moduleID) {
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

    Object.defineProperty(this, 'modulePath', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: modulePath
    });

    Object.defineProperty(this, 'moduleID', {
      writable: true,
      enumerable: false,
      configurable: true,
      value: moduleID
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
        // If this is a class wrap it (in the application context)
        if (value instanceof Function && ('' + value).match(/^class\s[A-Z]\w+\s\{/))
          value = this._application.wrapClass(value);

        this[key] = value;
      }
    }

    return this;
  }
}

(function(root) {
  function requireModule(name) {
    function requireByPath(name) {
      var thisModule, moduleID, tryRequire = [
        (moduleName) => {
          if (!moduleName.match(/^xoumz:\/\//))
            return;

          return require.resolve(path.resolve(__dirname, '..', moduleName.replace(/^xoumz:\/\//, './')));
        },
        (moduleName) => {
          return require.resolve(moduleName, {
            paths: [
              path.dirname(require.main.filename),
              path.resolve(__dirname, '..')
            ]
          });
        },
        (moduleName) => {
          return require.resolve(moduleName);
        }
      ];

      for (var i = 0, il = tryRequire.length; i < il; i++) {
        try {
          var modulePath = tryRequire[i](name);
          if (!modulePath)
            continue;

          moduleID = modulePath;//MD5(thisModule.toString()).toString();
          if (moduleCache[moduleID])
            return moduleCache[moduleID];

          thisModule = require(modulePath);

          break;
        } catch (e) {
          if (!e.message.match(/^Cannot find module/))
            console.error(e);
        }
      }

      if (!thisModule)
        throw new Error(`Unable to find module: ${name}`);

      var moduleRoot = thisModule;
      if (moduleRoot instanceof Function && (name.match(/^(\.|xoumz:\/\/)/) || (moduleRoot.xoumzPluginName && (typeof moduleRoot.xoumzPluginName === 'string' || moduleRoot.xoumzPluginName instanceof String)))) {
        moduleRoot = new ApplicationModule(application, moduleRoot.xoumzPluginName || name, thisModule.path, moduleID);

        var newRoot = thisModule.call(application, moduleRoot, application.requireModule, moduleRoot);
        if (newRoot !== undefined)
          moduleRoot = newRoot;
      }

      moduleCache[moduleID] = moduleRoot;

      return moduleRoot;
    }

    // function requireRaw(thisModule) {
    //   var moduleID = MD5(thisModule.toString()).toString();
    //   if (moduleCache[moduleID])
    //     return moduleCache[moduleID];

    //   if (thisModule instanceof Function && thisModule.xoumzPluginName && (typeof thisModule.xoumzPluginName === 'string' || thisModule.xoumzPluginName instanceof String)) {
    //     var moduleRoot = {},
    //         newRoot = name.call(application, moduleRoot, application.requireModule, thisModule.xoumzPluginName);

    //     if (newRoot !== undefined)
    //       moduleRoot = newRoot;

    //     moduleCache[thisModule.xoumzPluginName] = moduleRoot;

    //     return moduleRoot;
    //   } else {
    //     return name;
    //   }
    // }

    if (!(name && typeof name.valueOf() === 'string'))
      throw new Error('requireModule requires a string (path) argument');

    var opts = this,
        application = opts.application,
        moduleCache = application._modules,
        thisModule  = requireByPath(name);

    return thisModule;
  }

  Object.assign(root, {
    requireModule
  });
})(module.exports);
