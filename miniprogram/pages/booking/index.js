const { call, message } = require('../../utils/api');
Page({
  data: { items: [], loading: true },
  onShow() { if (this.getTabBar()) this.getTabBar().setData({ selected: 1 }); this.load(); },
  async load() { try { const d = await call('home'); this.setData({ items: d.exhibitions.filter(x => x.phase !== 'past'), loading: false }); } catch (e) { this.setData({ loading: false }); message(e); } },
  detail(e) { wx.navigateTo({ url: `/pages/exhibition/index?id=${e.currentTarget.dataset.id}` }); }
});
