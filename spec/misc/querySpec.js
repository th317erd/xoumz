describe('QueryUtils', function() {
  beforeEach(function() {
    const { QueryBuilder } = this.app.requireModule('./base/query-builder');
    this.QueryBuilder = QueryBuilder;
  });

  it('should be able to serialize a QueryBuilder instance', function() {
    var qb = new this.QueryBuilder();
    qb.type('User').field('id').equals('test').and((cb) => {
      cb.field('stuff').not().equals('wow').or((cb) => {
        cb.field('field1').equals('value1').or().field('field2').gte(56);
      });
    }).or().field('derp').equals('"hello" world? Yeah "right"').or().field('between').not().between(11, 234, true).field("bool").equals(true);

    expect(qb.serialize()).toBe("id=\"test\"&(stuff!=\"wow\"|(field1=\"value1\"|field2>=56))|derp=\"\\\"hello\\\" world? Yeah \\\"right\\\"\"|(between<=11|between>=234)|bool=true");
  });

  fit('should be able to serialize a QueryBuilder instance', function() {
    var qb = new this.QueryBuilder();
    qb.type('User').field('id').equals('test').and((cb) => {
      cb.field('stuff').not().equals('wow').or((cb) => {
        cb.field('field1').equals('value1').or().field('field2').gte(56);
      });
    }).or().field('derp').equals('"hello" world? Yeah "right"').or().field('between').not().between(11, 234, true).field("bool").equals(true);

    var str = qb.serialize();
    var newQb = this.QueryBuilder.unserialize(str);
    debugger;
  });
});
