const { call, message } = require('../../utils/api');
Page({
  data: { items: [], loading: true },
  onShow() { this.load(); },
  async load() { try { this.setData({ items: await call('myBookings'), loading: false }); } catch (e) { this.setData({ loading: false }); message(e); } },
  cancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({ title: '取消预约', content: '取消后名额会释放，确认取消吗？', success: async r => {
      if (!r.confirm) return;
      try { await call('cancel', { id }); wx.showToast({ title: '已取消' }); this.load(); } catch (err) { message(err); }
    } });
  }
});
