module.exports = function(root, requireModule) {
  const Permissible = requireModule('./security/permissible');
  const PermissionEngine = requireModule('./security/permission-engine');

  root.export(Permissible, PermissionEngine);
};
