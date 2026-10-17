const config = require('./config');
App({
  onLaunch() {
    if (config.demoMode) return;
    if (!wx.cloud) {
      wx.showModal({ title: '版本过低', content: '请升级微信后使用云服务', showCancel: false });
      return;
    }
    wx.cloud.init(config.cloudEnvId ? { env: config.cloudEnvId, traceUser: true } : { traceUser: true });
  },
  onError(error) {
    wx.showModal({ title: '页面加载失败', content: String(error).slice(0, 180), showCancel: false });
  },
  onUnhandledRejection(event) {
    const reason = event && event.reason;
    wx.showModal({ title: '页面加载失败', content: String(reason && reason.message || reason || '未知错误').slice(0, 180), showCancel: false });
  }
});
