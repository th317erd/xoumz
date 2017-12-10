module.exports = function(root, requireModule) {
  class Migration {
    constructor() {
    }

    async run() {
      throw new Error("Migration doesn't implement a run method");
    }
  }

  Object.assign(root, {
    Migration
  });
};

//table / bucket
