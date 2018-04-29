

module.exports = function(root, requireModule) {
  const ModelBase = requireModule('./models/model-base'),
        User = requireModule('./models/user'),
        Session = requireModule('./models/session');

  Object.assign(root, ModelBase, User, Session);
};
