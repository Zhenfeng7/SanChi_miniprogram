const test = require('node:test');
const assert = require('node:assert/strict');
const { fitCover, keepInViewport, resizeAroundCenter } = require('../miniprogram/utils/image-crop');

test('a portrait image can be moved upward to include its top in a landscape card', () => {
  const image = fitCover(1000, 1500, 686, 380);
  assert.equal(image.width, 686);
  assert.equal(image.height, 1029);
  assert.equal(image.y, -324.5);
  assert.deepEqual(keepInViewport(0, 0, image.width, image.height, 686, 380), { x: 0, y: 0 });
  assert.deepEqual(keepInViewport(0, -1000, image.width, image.height, 686, 380), { x: 0, y: -649 });
});

test('zoom retains the selected image center and keeps the crop covered', () => {
  const oldImage = { width: 700, height: 500, x: -14, y: -80 };
  const position = resizeAroundCenter(oldImage, { width: 1050, height: 750 }, 686, 380);
  assert.equal(position.x, -192.5);
  assert.equal(position.y, -215);
});
