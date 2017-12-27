const path = require('path'),
      { MD5 } = require('crypto-js');

(function(root) {
  function requireModule(name) {
    function getModuleName(thisModulePath) {
      var startIndex = thisModulePath.indexOf(__dirname);
      if (startIndex === 0)
        return thisModulePath.substring(__dirname.length).replace(/^[\\\/]+/g, '').replace(/\.js$/i, '');
    }

    function requireByPath(name) {
      var thisModule, moduleID, tryRequire = [
        (moduleName) => {
          if (!moduleName.match(/^xoumz:\/\//))
            return;

          return require(path.resolve(__dirname, moduleName.replace(/^xoumz:\/\//, './')));
        },
        (moduleName) => require(moduleName),
        (moduleName) => {
          if (moduleName.charAt(0) !== '.')
            return;

          return require(path.resolve(__dirname, moduleName));
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
        moduleRoot = {};
        var moduleName = moduleRoot.moduleName = getModuleName(thisModule.xoumzPluginName || name),
            newRoot = thisModule.call(application, moduleRoot, application.requireModule, moduleName, moduleID);

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
