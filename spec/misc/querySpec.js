describe('QueryBuilder', function() {
  beforeEach(function() {
    const { QueryBuilder } = this.app.requireModule('./base/query-builder');
    this.QueryBuilder = QueryBuilder;

    this.query = new this.QueryBuilder();
    this.query.type('FakeModel1').field('id').equals('test').and((cb) => {
      cb.type('FakeModel2').field('stuff').not().equals('wow').or((cb) => {
        cb.field('field1').equals('value1').or().field('field2').gte(56);
      });
    }).or().field('derp').equals('"hello" world? Yeah "right"').or().field('between').not().between(11, 234, true).field('bool').equals(true).field('many').not().contains('derp', true, 45.65);
  });

  it('should be able to serialize a QueryBuilder instance', function() {
    var str = this.query.serialize();
    expect(str).toBe('FakeModel1:id="test"&(FakeModel2:stuff!="wow"|(FakeModel2:field1="value1"|FakeModel2:field2>=56))|FakeModel1:derp="\\"hello\\" world? Yeah \\"right\\""|(FakeModel1:between<=11|FakeModel1:between>=234)|FakeModel1:bool=true|FakeModel1:many!~["derp",true,45.65]');
  });

  it('should be able to serialize a QueryBuilder instance', function() {
    var str = this.query.serialize(),
        newQb = this.QueryBuilder.unserialize(str);

    expect(newQb.serialize()).toBe(str);
  });
});
