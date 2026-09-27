export const RELEASE_DATE='2026-09-27';
export interface ReleaseSection {title:string;items:string[]}

const SHARED_SECTIONS:ReleaseSection[]=[
 {
  "title": "自定义条目",
  "items": [
   "增加了自定义条目的参考格式和逐框填写示例。",
   "优化了选中自定义条目的逻辑，现在先显示正文。"
  ]
 },
 {
  "title": "界面与操作",
  "items": [
   "提示条改从顶部出现，可以直接开启编辑模式。",
   "增加了编辑模式下左侧角色卡区域的描边提示。",
   "减少手机长按拖拽时误选文字；实际手机待验证。",
   "普通模式不可拖动的气泡不再显示抓手光标。",
   "编辑开关移到 A4 工具栏右侧，切换卡片会保留编辑模式。",
   "优化了部分内容的显示。"
  ]
 },
 {
  "title": "角色管理与导入导出",
  "items": [
   "JSON 可以直接复制粘贴，也可以导出指定角色或多卡备份了。",
   "现在可以导出五页 PNG、PDF，并隐藏部分内容或合拢特性了。",
   "角色簿支持概况、多选删除、批量创建和导出了。",
   "新增了 DM 审卡界面，集中查看数值、来源、法术和装备。",
   "JSON 导出再导入后，Wiki 条目不会再变成自定义条目了。"
  ]
 },
 {
  "title": "Wiki 与装备词条",
  "items": [
   "优化了 Wiki 加载速度；全库操作流畅度待验证。",
   "增加了装备词条，补齐护甲、武器大类、工具和载具熟练。",
   "Wiki 正文中的装备引用也可以拖入熟练栏了。",
   "补充了起始装备，起始熟练项和装备排在职业成长表前。",
   "增加了 Wiki 和卡内气泡的右键菜单。",
   "修复了突袭、浴血、专注没有跟随来源顺序的问题。",
   "搜索支持拼音和首字母了，点击结果会定位到对应条目。"
  ]
 },
 {
  "title": "法术",
  "items": [
   "修改预备法术后，主要页现在会立即更新；实际使用待验证。",
   "普通模式点击法术只查看，编辑模式才修改预备。"
  ]
 }
];

const withJsonNote=(note:string):ReleaseSection[]=>SHARED_SECTIONS.map(section=>
 section.title==='角色管理与导入导出'?{...section,items:[...section.items,note]}:section);

export const RELEASE_SECTIONS=withJsonNote('统一了角色 JSON 备份格式。');
export const SUITE_RELEASE_SECTIONS:ReleaseSection[]=[
 ...withJsonNote('统一了 JSON，不再区分枭熊 JSON 和普通 JSON。'),
 ...[
 {
  "title": "怪物与状态",
  "items": [
   "优化了怪物编辑面板，复杂内容仍可使用 JSON。",
   "修复了怪物图鉴加载出错的问题。",
   "修复了移除状态后头顶标识残留的问题；真实多人房间待验证。"
  ]
 },
 {
  "title": "枭熊联动与投骰",
  "items": [
   "优化了加载角色卡的流畅度；真实房间待验证。",
   "修正了所属玩家光源共享处理；真实房间视野待验证。",
   "部分玩家缺少投骰按钮：待验证，尚未复现。",
   "修正了无卡棋子的血量气泡处理；地图显示效果待验证。",
   "新增玩家可见、仅 DM 能开关的门；真实动态视野待验证。",
   "骰子历史现在显示完整公式，包括 max(1d20,20)。"
  ]
 },
 {
  "title": "三龙牌",
  "items": [
   "新建三龙牌改由服务器同步，减少出牌、准备和结算的等待。",
   "断线重连和刷新会恢复牌局，重复提交不会重复出牌。",
   "新增时光龙牌组，实际多人网络与手机流畅度待验证。",
   "三龙牌支持主动移交主持后离开了。",
   "三龙牌 DM 不入座也可开启获准的全能视图；真实多人牌局待验证。"
  ]
 }
]
];

export const RELEASE_NOTES=RELEASE_SECTIONS.flatMap(section=>section.items);
export const SUITE_RELEASE_NOTES=SUITE_RELEASE_SECTIONS.flatMap(section=>section.items);
export const releaseSectionsFor=(mode:'standalone'|'suite')=>mode==='suite'?SUITE_RELEASE_SECTIONS:RELEASE_SECTIONS;
