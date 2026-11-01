const { call, message } = require('../../utils/api');
Page({
  data: { members: [], phone: '', candidate: null, viewerOpenid: '', busy: false },
  onShow() { this.load(); },
  async load() { try { const [members, status] = await Promise.all([call('adminMembers'), call('adminStatus')]); this.setData({ members, viewerOpenid: status.openid }); } catch (e) { message(e); } },
  phoneInput(e) { this.setData({ phone: e.detail.value, candidate: null }); },
  async lookup() {
    if (this.data.busy) return;
    this.setData({ busy: true, candidate: null });
    try { this.setData({ candidate: await call('adminLookupUser', { phone: this.data.phone.trim() }) }); }
    catch (e) { message(e); }
    finally { this.setData({ busy: false }); }
  },
  async add() {
    if (this.data.busy || !this.data.candidate) return;
    const candidate = this.data.candidate;
    const confirmation = await new Promise(resolve => wx.showModal({ title: '确认添加管理员', content: `将“${candidate.name}”设为管理员？该微信账号将能查看访客联系方式，并修改展览和预约。`, success: x => resolve(x.confirm) }));
    if (!confirmation) return;
    this.setData({ busy: true });
    try { await call('adminSetMember', { openid: candidate.openid, enabled: true }); this.setData({ candidate: null, phone: '' }); await this.load(); wx.showToast({ title: '添加成功', icon: 'success' }); }
    catch (e) { message(e); }
    finally { this.setData({ busy: false }); }
  },
  async remove(e) {
    if (this.data.busy) return;
    const id = e.currentTarget.dataset.id;
    const member = this.data.members.find(x => x.openid === id);
    if (!member || member.isOwner) return;
    const confirmation = await new Promise(resolve => wx.showModal({ title: '移除管理员', content: `移除“${member.name}”的馆方管理权限？`, success: x => resolve(x.confirm) }));
    if (!confirmation) return;
    this.setData({ busy: true });
    try { await call('adminSetMember', { openid: id, enabled: false }); await this.load(); wx.showToast({ title: '已移除', icon: 'success' }); }
    catch (e) { message(e); }
    finally { this.setData({ busy: false }); }
  },
  async setAccountManager(e) {
    if (this.data.busy) return;
    const id = e.currentTarget.dataset.id;
    const member = this.data.members.find(x => x.openid === id);
    if (!member || member.isOwner || id === this.data.viewerOpenid) return;
    const enabled = !member.canManageAdmins;
    const confirmation = await new Promise(resolve => wx.showModal({ title: enabled ? '授予账号管理权限' : '收回账号管理权限', content: enabled ? `授权“${member.name}”添加、移除管理员，并继续授予其他管理员相同权限？` : `收回“${member.name}”的账号管理权限？其普通馆方管理权限会保留。`, success: x => resolve(x.confirm) }));
    if (!confirmation) return;
    this.setData({ busy: true });
    try { await call('adminSetAccountManager', { openid: id, enabled }); await this.load(); wx.showToast({ title: enabled ? '已授权' : '已收回', icon: 'success' }); }
    catch (error) { message(error); }
    finally { this.setData({ busy: false }); }
  }
});
