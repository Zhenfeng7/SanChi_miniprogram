const assert = require('node:assert/strict');
const { imageUrls } = require('../miniprogram/utils/cloud-images');

const calls = [];
global.wx = { cloud: { getTempFileURL: async ({ fileList }) => {
  calls.push(fileList);
  return { fileList: fileList.map(fileID => ({ fileID, tempFileURL: fileID === 'cloud://missing' ? '' : `https://example.test/${fileID.slice(8)}`, status: fileID === 'cloud://missing' ? -1 : 0 })) };
} } };

(async () => {
  const image = await imageUrls(['cloud://a', 'cloud://a', 'cloud://missing', '/images/local.jpg', 'https://example.test/direct.jpg']);
  assert.deepEqual(calls, [['cloud://a', 'cloud://missing']]);
  assert.equal(image('cloud://a'), 'https://example.test/a');
  assert.equal(image('cloud://missing'), '');
  assert.equal(image('/images/local.jpg'), '/images/local.jpg');
  assert.equal(image('https://example.test/direct.jpg'), 'https://example.test/direct.jpg');
  console.log('cloud image URLs: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
