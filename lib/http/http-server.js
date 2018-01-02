module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');

  class HTTPServer {
    constructor(_opts) {
      var opts = _opts || {};
    }
  }

  Object.assign(root, {
    HTTPServer
  });
};

//table / bucket
