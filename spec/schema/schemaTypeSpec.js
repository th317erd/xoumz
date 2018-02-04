describe('SchemaType', function() {
  beforeEach(function() {
    this.SchemaType = this.app.getSchemaEngine().getSchemaTypeClass();
    this.types = this.app.getSchemaEngine().getSchemaTypes();
    this.type = this.types.String;
  });

  describe('Internal functionality', function() {
    it('context should properly switch', function() {
      expect(this.type._context).toBe('*');
      this.type.context('test', (context) => {
        expect(context._context).toBe('test');
      });
      expect(this.type._context).toBe('*');
    });
  });

  describe('External functionality', function() {
    it('should be able to handle bad method arguments', function() {
      expect(this.type.context.bind(this.type, null)).toThrow();
      expect(this.type.context.bind(this.type, undefined)).toThrow();
      expect(this.type.context.bind(this.type, '')).toThrow();
      expect(this.type.context.bind(this.type, 'test')).toThrow();
      expect(this.type.context.bind(this.type, 'test', 'string')).toThrow();
      expect(this.type.context.bind(this.type, 'test', 0)).toThrow();
      expect(this.type.context.bind(this.type, 'test', true)).toThrow();
    });

    it('should be able to set all schema properties', function() {
      var validateFuncCalled = false;
      const validateFunc = function() {
        validateFuncCalled = true;
      };

      this.type
        .field('test')
        .notNull
        .primaryKey
        .required
        .validator(validateFunc);

      expect(this.type.getProp('field')).toBe('test');
      expect(this.type.getProp('notNull')).toBe(true);
      expect(this.type.getProp('primaryKey')).toBe(true);
      expect(this.type.getProp('validators')).toBeTruthy();
      expect(this.type.getProp('validators') instanceof Array).toBeTruthy();
      expect(this.type.getProp('validators').length).toBe(2);
      expect(this.type.getProp('validators')[1]).toBeType(Function);

      this.type.getProp('validators')[1]();
      expect(validateFuncCalled).toBe(true);
    });

    it('should be able to use getters and setters', function() {
      const validateFunc = function() {};
      this.type
        .field('test')
        .getter((val) => {
          return ('' + val).toUpperCase();
        })
        .setter((val) => {
          return ('' + val).replace(/\W+/g, '');
        });

      var getter = this.type.getProp('getter'),
          setter = this.type.getProp('setter');

      expect(this.type.getProp('field')).toBe('test');
      expect(getter instanceof Function).toBe(true);
      expect(setter instanceof Function).toBe(true);
      expect(getter('test')).toBe('TEST');
      expect(setter('-*Hello, World!!!')).toBe('HelloWorld');
    });

    it('should be able to set all schema properties with contexts', function() {
      this.type
        .field('test')
        .context('test1', (context) => {
          context.field('test1');
        })
        .context('test2', (context) => {
          context.field('test2');
        });

      expect(this.type.getProp('field')).toBe('test');
      expect(this.type.getProp('field', 'test1')).toBe('test1');
      expect(this.type.getProp('field', 'test2')).toBe('test2');
    });

    it('should lock', function() {
      this.type.field('test').lock();

      expect(this.type.field.bind(this.type, 'test2')).toThrow();
    });
  });
});
