describe('QueryUtils', function() {
  beforeEach(function() {
    const { QueryBuilder } = this.app.requireModule('./base/query-builder');
    this.QueryBuilder = QueryBuilder;
  });

  it('should be able to work with mime types', function() {
    var qb = new this.QueryBuilder();
    qb.type('User').field('id').equals('test').and((cb) => {
      cb.field('stuff').not().equals('wow').or((cb) => {
        cb.field('field1').equals('value1').or().field('field2').gte(56);
      });
    }).or().field('derp').equals('hello').or().field('between').not().between(11, 234, true);

    var str = qb.serialize();
    debugger;
  });
});
