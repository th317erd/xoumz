module.exports = function(root, requireModule) {
  const Session = requireModule('./models/models/session'),
        User = requireModule('./models/models/user'),
        Scope = requireModule('./models/models/scope'),
        Collection = requireModule('./models/models/collection');

  root.export(Session, User, Scope, Collection);
};
