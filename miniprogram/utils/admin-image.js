function cropBeforeUpload(file, ratio) {
  return new Promise((resolve, reject) => {
    wx.navigateTo({
      url: `/pages/admin-image-crop/index?src=${encodeURIComponent(file)}&ratio=${ratio}`,
      success(result) {
        result.eventChannel.on('confirmed', data => resolve(data.tempFilePath));
        result.eventChannel.on('cancelled', () => reject({ errMsg: 'cancel' }));
      },
      fail: reject
    });
  });
}

async function chooseAndUpload(folder, count = 1, cropRatio = 0) {
  const result = await new Promise((resolve, reject) => {
    wx.chooseImage({ count: cropRatio ? 1 : count, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: resolve, fail: reject });
  });
  const paths = [];
  for (const file of result.tempFilePaths) paths.push(cropRatio ? await cropBeforeUpload(file, cropRatio) : file);
  return Promise.all(paths.map((file, i) => {
    const ext = /\.(png|jpe?g|webp)$/i.exec(file);
    const cloudPath = `gallery-admin/${folder}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}.${ext ? ext[1].toLowerCase() : 'jpg'}`;
    return wx.cloud.uploadFile({ cloudPath, filePath: file }).then(x => x.fileID);
  }));
}
module.exports = { chooseAndUpload };
