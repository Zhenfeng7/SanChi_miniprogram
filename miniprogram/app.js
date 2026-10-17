const config = require('./config');
App({
  onLaunch() {
    if (config.demoMode) return;
    if (!wx.cloud) {
      wx.showModal({ title: '版本过低', content: '请升级微信后使用云服务', showCancel: false });
      return;
    }
    wx.cloud.init(config.cloudEnvId ? { env: config.cloudEnvId, traceUser: true } : { traceUser: true });
  }
});
