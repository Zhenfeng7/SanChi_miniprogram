const { call, message } = require('../../utils/api');
const { withImages } = require('../../utils/exhibition-images');
const { imageUrls } = require('../../utils/cloud-images');
Page({
  data: { items: [], loading: true },
  onShow() { if (this.getTabBar()) this.getTabBar().setData({ selected: 1 }); this.load(); },
  async load() { try { const d = await call('home'); const items = d.exhibitions.filter(x => x.phase !== 'past').map(withImages); const image = await imageUrls(items.map(x => x.coverImage)); this.setData({ items: items.map(x => ({ ...x, coverImage: image(x.coverImage) })), loading: false }); } catch (e) { this.setData({ loading: false }); message(e); } },
  detail(e) { wx.navigateTo({ url: `/pages/exhibition/index?id=${e.currentTarget.dataset.id}` }); }
});
