module.exports = function(root, requireModule) {
  const Session = requireModule('./models/models/session'),
        User = requireModule('./models/models/user');

  root.export(Session, User);
};
