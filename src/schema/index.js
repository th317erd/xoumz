

module.exports = function(root, requireModule) {
  const Schema = requireModule('./schema/schema');
  
  Object.assign(root, Schema, {});
};
