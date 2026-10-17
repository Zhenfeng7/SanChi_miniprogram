App({
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: '版本过低', content: '请升级微信后使用云服务', showCancel: false });
      return;
    }
    wx.cloud.init({ traceUser: true });
  }
});
