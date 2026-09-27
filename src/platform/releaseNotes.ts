export const RELEASE_DATE='2026-09-28';
export interface ReleaseSection {title:string;items:string[]}

const SHARED_SECTIONS:ReleaseSection[]=[
 {title:'浏览器兼容与加载',items:['修复了部分旧版浏览器读取 Wiki 和连接服务器时加载失败的问题。','资料缓存写满时，已下载成功的资料仍可查看。','程序加载失败时，现在显示原因和重新加载按钮。']},
 {title:'本次修复：职业与法术',items:[
  '现在每个主职业都可以单独查找和添加子职了。',
  '修复了职业正文中的子职没有跟随 2014 / 2024 筛选的问题。',
  '现在可以把 Wiki 法术直接拖进预备栏了，预备上限调整会生效。',
  '补齐导入职业与原资料的关联，修复法表和子职匹配。',
  '兼职角色现在可以按职业查看法表、法术攻击和 DC。'
 ]},
 {title:'本次修复：拖拽与内容',items:[
  '拖动法术和装备时，角色卡会切换到对应页面；熟练项引用保留当前页。',
  '减少拖拽时的重复计算，实际手机手感待验证。',
  '修复了自定义条目的中文名和英文名互相覆盖的问题。',
  '宝石和艺术品类型现在显示中文，未知重量不再显示成零。'
 ]},
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

export const ARCHIVED_RELEASE_SECTIONS=withJsonNote('统一了角色 JSON 备份格式。');
export const SUITE_ARCHIVED_RELEASE_SECTIONS:ReleaseSection[]=[
 {title:'本次修复：权限与同步',items:[
  'DM 现在可以在角色卡上点击“分配玩家”，授予和撤回编辑权限。',
  '编辑权限变化后会直接更新开关，不用重新导入角色卡。',
  '撤回编辑权限后，其他场景的旧棋子不会重新授予权限。',
  '修复了旧场景角色目录反复互相覆盖、触发大量同步的问题。',
  '切换角色卡不再反复把所有角色和头像写入本机备份。',
  '状态目录同步慢时，不再阻塞已保存角色的操作。',
  '角色修改增加了服务器通知，网页连接开启 HTTP/2。',
  '真实多人房间、场景棋子切换和海外 VPN 速度：待验证。'
 ]},
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
   "修复了回合横幅抢先播放的问题，现在等落牌动画结束后再显示。",
   "新建三龙牌改由服务器同步，减少出牌、准备和结算的等待。",
   "断线重连和刷新会恢复牌局，重复提交不会重复出牌。",
   "新增时光龙牌组，实际多人网络与手机流畅度待验证。",
   "三龙牌支持主动移交主持后离开了。",
   "三龙牌 DM 不入座也可开启获准的全能视图；真实多人牌局待验证。"
  ]
 }
]
];

const PREVIOUS_RELEASE_SECTIONS:ReleaseSection[]=[
 {title:'角色卡与导入导出',items:['修复了角色 JSON 转换时遗漏已填写武器攻击的问题。','武器命中和伤害公式现在会保留；玩家具体文件待验证。']},
 {title:'更新公告',items:['旧公告现在按日期折叠，同日更新按批次编号。']}
];
const PREVIOUS_SUITE_RELEASE_SECTIONS:ReleaseSection[]=[
 ...PREVIOUS_RELEASE_SECTIONS,
 {title:'三龙牌',items:['服务器牌桌的房主离开后，现在会自动交接给在线玩家。','短暂刷新和关闭重复窗口不会立即交接；真实多人房间待验证。','修复了自选特殊牌列表无法向下滚动的问题；实体手机待验证。']},
 {title:'仍在排查',items:['卡上已移除但棋子状态残留、保存结果未确认的问题仍在排查。']}
];
export const RELEASE_SECTIONS:ReleaseSection[]=[
 {title:'基础自动化',items:['增加了基础自动化，可以在角色卡工具栏中开启。','装备护甲和盾牌后，现在可以自动计算 AC。','装备武器后，现在可以生成对应的快捷攻击。','支持部分特性和种族的赠送法术、免费次数与法术位消耗。']},
 {title:'法术列表',items:['优化了预备法术和已知法术列表，戏法与赠送法术分组显示。','点击已知法术可以选中打勾，再次点击取消；预备区显示对应法术。','修复了同名赠送法术阻挡普通预备的问题。','恢复了法术格原有样式、专注和仪式效果。']},
 {title:'待验证',items:['实体手机操作待验证；复杂兼职、动态次数和完整休息规则尚未全部支持。']}
];
export const SUITE_RELEASE_SECTIONS:ReleaseSection[]=[...RELEASE_SECTIONS,
 {title:'枭熊联动',items:['基础自动化的真实多人同步待验证。']},
 {title:'仍在排查',items:['卡上已移除但棋子状态残留、保存结果未确认的问题仍在排查。']}
];
export const RELEASE_NOTES=RELEASE_SECTIONS.flatMap(section=>section.items);
export const SUITE_RELEASE_NOTES=SUITE_RELEASE_SECTIONS.flatMap(section=>section.items);
export const releaseSectionsFor=(mode:'standalone'|'suite')=>mode==='suite'?SUITE_RELEASE_SECTIONS:RELEASE_SECTIONS;
export const releaseHistoryFor=(mode:'standalone'|'suite')=>[
 {title:RELEASE_DATE,sections:releaseSectionsFor(mode)},
 {title:'2026-09-27-二',sections:mode==='suite'?PREVIOUS_SUITE_RELEASE_SECTIONS:PREVIOUS_RELEASE_SECTIONS},
 {title:'2026-09-27-一',sections:mode==='suite'?SUITE_ARCHIVED_RELEASE_SECTIONS:ARCHIVED_RELEASE_SECTIONS},
];
