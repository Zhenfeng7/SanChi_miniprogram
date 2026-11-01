function chooseAndUpload(folder, count = 1) {
  return new Promise((resolve, reject) => {
    wx.chooseImage({ count, sizeType: ['compressed'], sourceType: ['album', 'camera'], success: resolve, fail: reject });
  }).then(result => Promise.all(result.tempFilePaths.map((file, i) => {
    const ext = /\.(png|jpe?g|webp)$/i.exec(file);
    const cloudPath = `gallery-admin/${folder}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}.${ext ? ext[1].toLowerCase() : 'jpg'}`;
    return wx.cloud.uploadFile({ cloudPath, filePath: file }).then(x => x.fileID);
  })));
}
module.exports = { chooseAndUpload };
