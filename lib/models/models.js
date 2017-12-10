

module.exports = function(root, requireModule) {
  const User = requireModule('./models/user');
  
  Object.assign(root, User);
};
