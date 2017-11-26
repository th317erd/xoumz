import path from 'path';

(function(root) {
  function requireModule(name) {
    function getModuleName(thisModulePath) {
      var startIndex = thisModulePath.indexOf(__dirname);
      if (startIndex === 0)
        return thisModulePath.substring(__dirname.length).replace(/^[\\\/]+/g, '').replace(/\.js$/i, '');
    }

    function pluginify(_thisModuleRoot) {
      var thisModuleRoot = _thisModuleRoot;
      for (var i = 0, il = plugins.length; i < il; i++) {
        var plugin = plugins[i];
        if (!plugin)
          continue;

        if (plugin instanceof String || typeof plugin === 'string')
          plugin = require(plugin);

        if (!(plugin instanceof Function))
          throw new Error('Plugins must be functions, or module paths that resolve to modules that export a function');

        var newModule = plugin(thisModuleRoot, thisModuleRoot.moduleName || modulePath);
        if (newModule)
          thisModuleRoot = newModule;
      }

      return thisModuleRoot;
    }

    var opts = this,
        application = opts.application,
        plugins = opts.plugins,
        moduleCache = application._modules,
        modulePath = require.resolve((name.charAt(0) === '.') ? path.resolve(__dirname, name) : name);

    if (moduleCache[modulePath])
      return moduleCache[modulePath];

    var moduleExports = require(modulePath),
        moduleRoot = moduleExports;

    if (moduleExports instanceof Function && name.charAt(0) === '.') {
      moduleRoot = {};
      moduleExports(moduleRoot, application.requireModule);
      moduleRoot.moduleName = getModuleName(modulePath);
    }

    moduleRoot = pluginify(moduleRoot);
    moduleCache[modulePath] = moduleRoot;

    return moduleRoot;
  }

  Object.assign(root, {
    requireModule
  });
})(module.exports);
