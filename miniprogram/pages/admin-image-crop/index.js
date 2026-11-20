const { fitCover, keepInViewport, resizeAroundCenter } = require('../../utils/image-crop');

function getImageInfo(src) {
  return new Promise((resolve, reject) => wx.getImageInfo({ src, success: resolve, fail: reject }));
}

Page({
  data: { ready: false, saving: false, src: '', viewportWidth: 0, viewportHeight: 0, imageWidth: 0, imageHeight: 0, x: 0, y: 0, zoomPercent: 100, outputWidth: 1080, outputHeight: 600 },
  async onLoad(options) {
    try {
      const src = decodeURIComponent(options.src || '');
      const ratio = Number(options.ratio);
      if (!src || !Number.isFinite(ratio) || ratio <= 0) throw Error('图片参数无效');
      const info = await getImageInfo(src);
      const viewportWidth = wx.getSystemInfoSync().windowWidth - 40;
      const viewportHeight = viewportWidth / ratio;
      const image = fitCover(info.width, info.height, viewportWidth, viewportHeight);
      const outputWidth = 1080;
      const outputHeight = Math.round(outputWidth / ratio);
      this.sourceSize = { width: info.width, height: info.height };
      this.position = { x: image.x, y: image.y };
      this.setData({ ready: true, src, viewportWidth, viewportHeight, imageWidth: image.width, imageHeight: image.height, x: image.x, y: image.y, outputWidth, outputHeight });
    } catch (e) {
      wx.showToast({ title: e.message || '图片读取失败', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1000);
    }
  },
  moved(e) {
    if (!this.data.ready) return;
    this.position = keepInViewport(e.detail.x, e.detail.y, this.data.imageWidth, this.data.imageHeight,
      this.data.viewportWidth, this.data.viewportHeight);
  },
  zoomChanged(e) {
    const zoomPercent = Number(e.detail.value);
    const oldImage = { width: this.data.imageWidth, height: this.data.imageHeight, ...this.position };
    const next = fitCover(this.sourceSize.width, this.sourceSize.height, this.data.viewportWidth, this.data.viewportHeight, zoomPercent / 100);
    const position = resizeAroundCenter(oldImage, next, this.data.viewportWidth, this.data.viewportHeight);
    this.position = position;
    this.setData({ zoomPercent, imageWidth: next.width, imageHeight: next.height, ...position });
  },
  confirm() {
    if (this.data.saving || !this.data.ready) return;
    this.setData({ saving: true });
    const { src, viewportWidth, imageWidth, imageHeight, outputWidth, outputHeight } = this.data;
    const scale = outputWidth / viewportWidth;
    const { x, y } = this.position;
    const context = wx.createCanvasContext('cropCanvas', this);
    context.drawImage(src, x * scale, y * scale, imageWidth * scale, imageHeight * scale);
    context.draw(false, () => {
      wx.canvasToTempFilePath({ canvasId: 'cropCanvas', width: outputWidth, height: outputHeight,
        destWidth: outputWidth, destHeight: outputHeight, fileType: 'jpg', quality: 0.9,
        success: result => { this.finished = true; this.getOpenerEventChannel().emit('confirmed', { tempFilePath: result.tempFilePath }); wx.navigateBack(); },
        fail: error => { this.setData({ saving: false }); wx.showToast({ title: error.errMsg || '裁剪失败', icon: 'none' }); }
      }, this);
    });
  },
  cancel() { wx.navigateBack(); },
  onUnload() { if (!this.finished) this.getOpenerEventChannel().emit('cancelled'); }
});
