module.exports = function(root, requireModule) {
  const { definePropertyRW } = requireModule('./utils');

  function addTODOSWithExtra(items, extra) {
    return this.todo(items.map((item) => {
      return {
        ...item,
        ...extra
      };
    }));
  }

  class SchemaValidationReport {
    constructor(_opts) {
      var opts = Object.assign({}, _opts || {});

      definePropertyRW(this, 'errors', []);
      definePropertyRW(this, 'warnings', []);
      definePropertyRW(this, 'todos', []);
      definePropertyRW(this, 'valid', undefined, () => (this.errors.length === 0 && this.todos.length === 0), () => {});
    }

    error(...args) {
      this.errors = this.errors.concat(args);
      return this;
    }

    warnings(...args) {
      this.warnings = this.warnings.concat(args);
      return this;
    }

    todo(action, ...items) {
      this.todos = this.todos.concat(items.map((item) => {
        return {
          action,
          item
        };
      }));

      return this;
    }

    missing(...items) {
      return this.todo('add', items);
    }

    modified(...items) {
      return this.todo('modify', items);
    }

    removed(...items) {
      return this.todo('remove', items);
    }
  }

  Object.assign(root, {
    SchemaValidationReport
  });
};
