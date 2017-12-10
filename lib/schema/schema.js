

module.exports = function(root, requireModule) {
  const Schema = requireModule('./schema/schema-engine');
  
  Object.assign(root, Schema, {});
};
