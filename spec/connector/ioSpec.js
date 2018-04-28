// const moment = require('moment');

// describe('Connector IO', function() {
//   beforeEach(function(done) {
//     (async () => {
//       this.model = await this.createTestModel();
//       done();
//     })();
//   });

//   describe('Internal functionality', function() {
//     // TODO: Add more internal stress testing
//   });

//   describe('External functionality', function() {
//     fit('should be able to decompose a model', async function(done) {
//       // Decomposition should always be in order because the field names of the model are sorted

//       var decomposed = await this.model.decompose();
//       debugger;

//       expect(decomposed).toBeArray(13);

//       // Test Model
//       this.testDecomposedModel(decomposed[0].getValue());

//       // Test Child Model
//       this.testChildDecomposedModel(decomposed[1].getValue());

//       // String Model (Test:2)
//       expect(decomposed[7].getValue()).toBePrimitiveModel({
//         type: 'String',
//         value: 'child',
//         ownerID: 'Test:2',
//         ownerField: 'stringArray',
//         ownerType: 'Test'
//       });

//       // Integer Model (Test:1)
//       expect(decomposed[8].getValue()).toBePrimitiveModel({
//         type: 'Integer',
//         value: 42,
//         ownerID: 'Test:1',
//         ownerField: 'integerArray',
//         ownerType: 'Test'
//       });

//       done();
//     });

//     it('should be able to save a model', function(done) {
//       (async function run() {
//         var ret = await this.model.save();

//         expect(ret).toBeArray(1);
//         expect(ret[0].errors).toBeArray(0);
//         expect(ret[0].success).toBeTheSame(true);

//         done();
//       }).call(this);
//     });

//     it('should be able to load saved model', function(done) {
//       (async function run() {
//         var model = await this.app.query('Test').id.eq('Test:1').first;

//         debugger;

//         expect(model).toBeType(this.app.getSchemaEngine().getModelBaseClass());

//         // Make sure reconstructed model and original model are different
//         expect(this.model).not.toBeTheSame(model);

//         // Test reconstructed model
//         this.testModel(model, true);
//         expect(model.children).toBeArray(1);
//         expect(model.stringArray).toBeArray(2);
//         expect(model.stringArray[0]).toBeTheSame('hello');
//         expect(model.stringArray[1]).toBeTheSame('world');
//         expect(model.integerArray).toBeArray(3);
//         expect(model.integerArray[0]).toBeTheSame(42);
//         expect(model.integerArray[1]).toBeTheSame(0);
//         expect(model.integerArray[2]).toBeTheSame(1);

//         // Test reconstructed child
//         var child = model.children[0];
//         expect(this.model.children[0]).not.toBeTheSame(child);
//         this.testChild(child, true);
//         expect(child.children).toBeArray(0);
//         expect(child.stringArray).toBeArray(3);
//         expect(child.stringArray[0]).toBeTheSame('hello');
//         expect(child.stringArray[1]).toBeTheSame('from');
//         expect(child.stringArray[2]).toBeTheSame('child');
//         expect(child.integerArray).toBeArray(3);
//         expect(child.integerArray[0]).toBeTheSame(1);
//         expect(child.integerArray[1]).toBeTheSame(42);
//         expect(child.integerArray[2]).toBeTheSame(0);

//         done();
//       }).call(this);
//     });
//   });
// });
