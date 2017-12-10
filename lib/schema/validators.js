module.exports = function(root, requireModule) {
  const { noe } = requireModule('./utils');
  
  function required(val) {
    if (noe(val))
      throw new Error('Value required');
  }

  Object.assign(root, {
    required
  });
};
