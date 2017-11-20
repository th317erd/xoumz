import util from 'util';

(function(root) {
  function inspect(val) {
    return util.inspect(val, { depth: null, colors: true, showHidden: true });
  };

  Object.assign(root, {
    inspect
  });
})(module.exports);
