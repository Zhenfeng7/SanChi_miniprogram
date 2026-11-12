function isCloudImage(value) { return typeof value === 'string' && value.startsWith('cloud://'); }

async function imageUrls(values) {
  const ids = [...new Set(values.filter(isCloudImage))];
  const urls = {};
  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    try {
      const result = await wx.cloud.getTempFileURL({ fileList: batch });
      (result.fileList || []).forEach(file => {
        if (file.fileID && file.tempFileURL && !file.status) urls[file.fileID] = file.tempFileURL;
      });
    } catch (error) {
      console.warn('云图片链接获取失败', error);
    }
  }
  return value => isCloudImage(value) ? (urls[value] || '') : (value || '');
}

module.exports = { imageUrls };
