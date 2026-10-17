function call(action, data = {}) {
  return wx.cloud.callFunction({ name: 'gallery', data: { action, ...data } }).then(({ result }) => {
    if (!result || !result.ok) throw new Error((result && result.error) || '服务暂不可用');
    return result.data;
  });
}
function message(error) { wx.showToast({ title: error.message || '操作失败', icon: 'none', duration: 2800 }); }
module.exports = { call, message };
