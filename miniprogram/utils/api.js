const config = require('../config');
const demo = require('./demo');
function call(action, data = {}) {
  if (config.demoMode) return demo.call(action, data);
  return wx.cloud.callFunction({ name: 'gallery', data: Object.assign({ action: action }, data) }).then(response => {
    const result = response.result;
    if (!result || !result.ok) throw new Error((result && result.error) || '服务暂不可用');
    return result.data;
  });
}
function message(error) { wx.showToast({ title: error.message || '操作失败', icon: 'none', duration: 2800 }); }
module.exports = { call, message };
