const assert = require('chai').assert;
const configup = require('../');

describe('configup', function () {
  it('load with with default', function () {
    const config = configup.load(__dirname + '/fixtures/config', 'foo');
    assert.ok(config);
    assert.equal(config.foo, 'hello');
    assert.equal(config.bar, 'world');
  });

  it('should return undefined if no config files exists', function () {
    const config = configup.load(__dirname + '/fixtures/config', 'not_exist');
    assert.deepEqual(config, {});
  });
});
