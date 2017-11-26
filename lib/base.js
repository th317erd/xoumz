import path from 'path';

(function(root) {
  function requireModule(name) {
    function getModuleName(thisModulePath) {
      var startIndex = thisModulePath.indexOf(__dirname);
      if (startIndex === 0)
        return thisModulePath.substring(__dirname.length).replace(/^[\\\/]+/g, '').replace(/\.js$/i, '');
    }

    // function mutate(_thisModuleRoot) {
    //   var thisModuleRoot = _thisModuleRoot;
    //   for (var i = 0, il = mutators.length; i < il; i++) {
    //     var mutator = mutators[i];
    //     if (!mutator)
    //       continue;

    //     if (mutator instanceof String || typeof mutator === 'string')
    //       mutator = require(mutator);

    //     if (!(mutator instanceof Function))
    //       throw new Error('Mutators must be functions, or module paths that resolve to modules that export a function');

    //     var newModule = mutator(thisModuleRoot, thisModuleRoot.moduleName || modulePath);
    //     if (newModule)
    //       thisModuleRoot = newModule;
    //   }

    //   return thisModuleRoot;
    // }

    function requireByPath(name) {
      var thisModule, moduleID, tryRequire = [
        (moduleName) => {
          if (moduleName.charAt(0) !== '.')
            return;

          return require(path.resolve(__dirname, moduleName));
        },
        (moduleName) => require.main.require(moduleName),
        (moduleName) => require(moduleName)
      ];
      
      for (var i = 0, il = tryRequire.length; i < il; i++) {
        try {
          thisModule = tryRequire[i](name);
          if (!thisModule)
            continue;

          moduleID = thisModule.__id;

          if (!moduleID)
            moduleID = application._moduleUUIDCounter++;
          break;
        } catch (e) {
          console.error('DERP', e);
        }
      }

      if (!thisModule)
        throw new Error(`Unable to find module: ${name}`);

      if (moduleCache[moduleID])
        return moduleCache[moduleID];

      var moduleRoot = thisModule;
      if (thisModule instanceof Function && (name.charAt(0) === '.' || (thisModule.xoumzPluginName && (typeof thisModule.xoumzPluginName === 'string' || thisModule.xoumzPluginName instanceof String)))) {
        moduleRoot = {};
        var moduleName = moduleRoot.moduleName = getModuleName(thisModule.xoumzPluginName || name);
        thisModule.call(application, moduleRoot, application.requireModule, moduleName, moduleID);
      }

      //moduleRoot = mutate(moduleRoot);
      moduleCache[moduleID] = moduleRoot;

      return moduleRoot;
    }

    function requireRaw(thisModule) {
      if (thisModule instanceof Function && thisModule.xoumzPluginName && (typeof thisModule.xoumzPluginName === 'string' || thisModule.xoumzPluginName instanceof String)) {
        var moduleRoot = {};
        name.call(application, moduleRoot, application.requireModule, thisModule.xoumzPluginName);
        
        //moduleRoot = mutate(moduleRoot);
        moduleCache[thisModule.xoumzPluginName] = moduleRoot;

        return moduleRoot;
      } else {
        return name;
      }
    }

    var opts = this,
        application = opts.application,
        mutators = opts.mutators,
        moduleCache = application._modules,
        moduleUUIDCounter = application._moduleUUIDCounter,
        thisModule = (typeof name === 'string' || name instanceof String) ? requireByPath(name) : requireRaw(name);    

    return thisModule;
  }

  Object.assign(root, {
    requireModule
  });
})(module.exports);
