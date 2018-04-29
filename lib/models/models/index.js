module.exports = function(root, requireModule) {
  const Session = requireModule('./models/models/session'),
        User = requireModule('./models/models/user');

  Object.assign(root, {
    Session,
    User
  });
};
