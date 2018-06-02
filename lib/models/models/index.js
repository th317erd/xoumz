module.exports = function(root, requireModule) {
  const Session = requireModule('./models/models/session'),
        User = requireModule('./models/models/user'),
        Scope = requireModule('./models/models/scope');

  root.export(Session, User, Scope);
};
