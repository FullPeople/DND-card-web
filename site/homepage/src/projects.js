import kiwee from './assets/project-kiwee.webp';
import sealchat from './assets/project-sealchat.webp';
import desktopDice from './assets/project-desktop-dice.webp';
import musicboard from './assets/project-musicboard.webp';
import kiweeVideo from './assets/project-kiwee-demo.mp4';
import diceVideo from './assets/project-desktop-dice-demo.mp4';
import musicVideo from './assets/project-musicboard-demo.mp4';
import dragonVideo from './assets/project-three-dragon-demo.mp4';
import kiweePreview from './assets/project-kiwee-preview.mp4';
import dicePreview from './assets/project-desktop-dice-preview.mp4';
import musicPreview from './assets/project-musicboard-preview.mp4';
import dragonPreview from './assets/project-three-dragon-preview.mp4';
import dragon from './assets/project-three-dragon.webp';
import artists from './assets/project-artists.webp';
import baisheng from './assets/artist-baisheng.webp';
import zhongli from './assets/artist-zhongli.webp';
import dragonMobile from './assets/project-three-dragon-mobile.webp';
import kiweeMobile from './assets/project-kiwee-mobile.webp';
import sealchatMobile from './assets/project-sealchat-mobile.webp';
import diceMobile from './assets/project-desktop-dice-mobile.webp';
import musicMobile from './assets/project-musicboard-mobile.webp';
import artistsMobile from './assets/project-artists-mobile.webp';
import fullOffice from './assets/project-fulloffice.svg';

export const projects = [
  {
    id:'kiwee',
    src:kiwee,
    video:kiweePreview,
    fullVideo:kiweeVideo,
    title:`DND中文规则速查网站`,
    name:`DND中文规则速查网站`,
    author:`Kiwee`,
    summary:`Kiwee`,
    description:`Kiwee老师的友情链接。为 DND 5E / 5R 玩家和地下城主准备的中文资料站。查阅种族、职业、法术、物品和怪物，在创建角色与准备冒险时快速找到需要的规则。`,
    href:`https://5e.kiwee.top/`,
    linkLabel:`查看项目介绍`
  },
  {
    id:'sealchat',
    src:sealchat,
    title:`星尘-SealChat`,
    name:`星尘-SealChat`,
    author:`星尘`,
    summary:`新一代TRPG文字团平台`,
    description:`星尘老师的友情链接。SealChat是面向TRPG文字团的新一代平台，你可以通过下方项目介绍打开B站链接了解更多。`,
    href:`https://www.bilibili.com/video/BV1iDiiBDEbh/`,
    linkLabel:`查看项目介绍`
  },
  {
    id:'desktop-dice',
    src:desktopDice,
    video:dicePreview,
    fullVideo:diceVideo,
    title:`超越窗口的桌面3D骰子`,
    name:`超越窗口的桌面3D骰子`,
    author:`FullPeople`,
    summary:`FullDice`,
    description:`让 3D 骰子在桌面上展开，用联机码与同伴一起掷骰和聊天。支持断线恢复、暗骰和独立投掷，骰子跟随提交输入框所在的屏幕。本版修复备用显示层准备失败后的意外退出；已验证与音乐板同时恢复置顶遮挡和保留输入焦点。安装版可检查更新，便携版解压即可使用；联机时请让所有玩家使用同一新版。`,
    href:`/downloads/DesktopDice-0.2.2-Setup-windows-x64.exe`,
    download:!0,
    version:`0.2.2`,
    updated:`2026-10-14`,
    platforms:[{name:`Windows 安装版`,href:`/downloads/DesktopDice-0.2.2-Setup-windows-x64.exe`,download:!0},{name:`Windows 便携版`,href:`/downloads/DesktopDice-0.2.2-windows-x64.zip`,download:!0},{name:`macOS`,href:null}],
    alternateDownloads:[{name:`0.2.1 安装版`,href:`/downloads/DesktopDice-0.2.1-Setup-windows-x64.exe`},{name:`0.2.1 便携版`,href:`/downloads/DesktopDice-0.2.1-windows-x64.zip`}]
  },
  {
    id:'musicboard',
    src:musicboard,
    video:musicPreview,
    fullVideo:musicVideo,
    title:`便携桌面音乐板和悬浮窗`,
    name:`便携桌面音乐板和悬浮窗`,
    author:`FullPeople`,
    summary:`MusicBoard`,
    description:`用悬浮球控制 BGM 和音效。支持 YouTube、B 站、网易、QQ 音乐、SoundCloud、Bandcamp 和酷我等公开链接，可直接在线播放，也可下载入库后离线播放。本版改善临时断网后的恢复，停止和取消仍可及时响应；来源只提供试听时会标明试听片段。需要登录、付费、区域限制或无确定时长的来源可能无法使用。安装版支持检查更新，便携版解压即可使用。目前为开发版。`,
    href:`https://github.com/FullPeople/MusicBoard/releases/download/v0.3.5/MusicBoard-0.3.5-Setup-windows-x64.exe`,
    download:!0,
    version:`0.3.5`,
    updated:`2026-10-14`,
    platforms:[{name:`Windows 安装版`,href:`https://github.com/FullPeople/MusicBoard/releases/download/v0.3.5/MusicBoard-0.3.5-Setup-windows-x64.exe`,download:!0},{name:`Windows 便携版`,href:`https://github.com/FullPeople/MusicBoard/releases/download/v0.3.5/MusicBoard-0.3.5-windows-x64.zip`,download:!0},{name:`开源代码`,href:`https://github.com/FullPeople/MusicBoard`},{name:`macOS`,href:null}],
    alternateDownloads:[{name:`0.3.4 安装版`,href:`/downloads/MusicBoard-0.3.4-Setup-windows-x64.exe`},{name:`0.3.4 便携版`,href:`/downloads/MusicBoard-0.3.4-windows-x64.zip`}]
  },
  {
    id:'fulloffice',
    src:fullOffice,
    title:`文档、表格与 PDF 阅读`,
    name:`FullOffice`,
    author:`FullPeople`,
    summary:`开源桌面办公与阅读工具`,
    description:`编辑 DOCX、XLSX、PPTX，以及 ODT、ODS、ODP、RTF、CSV；阅读 PDF 与 Markdown。PDF 支持书签、彩色页签、批注、悬停引用和多个区域置顶；表格支持公式重算与原文件保存，可选定时保存。安装版可检查更新，并可在系统设置中选择为默认打开工具。目前为开发版，本版改善 PDF 定位后继续滚动的响应。Mac 候选支持 PDF 阅读、DOCX／XLSX 编辑和 Markdown／文本；Mac 新版完善升级备份；其余 PDF 工具和格式仍在补齐，安装包尚未公证。偶发编辑器空白仍在调查，建议先用副本试用重要文件。`,
    href:`https://github.com/FullPeople/FullOffice/releases/download/v0.3.5/FullOffice-0.3.5-Setup-windows-x64.exe`,
    download:!0,
    version:`Windows 0.3.5 · Mac 0.3.6`,
    updated:`2026-10-14`,
    platforms:[{name:`Windows 安装版`,href:`https://github.com/FullPeople/FullOffice/releases/download/v0.3.5/FullOffice-0.3.5-Setup-windows-x64.exe`,download:!0},{name:`Windows 便携版`,href:`https://github.com/FullPeople/FullOffice/releases/download/v0.3.5/FullOffice-0.3.5-windows-x64.zip`,download:!0},{name:`开源代码`,href:`https://github.com/FullPeople/FullOffice`},{name:`Mac · Apple 芯片`,href:`https://github.com/FullPeople/FullOffice/releases/download/v0.3.6/FullOffice-0.3.6-Setup-macos-arm64.pkg`,download:!0},{name:`Mac · Intel`,href:`https://github.com/FullPeople/FullOffice/releases/download/v0.3.6/FullOffice-0.3.6-Setup-macos-x64.pkg`,download:!0}],
    alternateDownloads:[{name:`0.3.4 安装版`,href:`/downloads/FullOffice-0.3.4-Setup-windows-x64.exe`},{name:`0.3.4 便携版`,href:`/downloads/FullOffice-0.3.4-windows-x64.zip`}]
  },
  {
    id:'three-dragon',
    src:dragon,
    video:dragonPreview,
    fullVideo:dragonVideo,
    title:`来一局三龙牌吧！`,
    name:`来一局三龙牌吧！`,
    author:`FullPeople`,
    summary:`三龙牌在线网页`,
    description:`还原了威世智的传奇版三龙牌规则的网页联机游戏！叫上你的好友，一起来一把三龙牌吧！（注：你得自己去寻找好友，向ta发送链接。）`,
    href:`https://dnd.center/3-dragon/`,
    linkLabel:`来一局三龙牌`
  },
  {
    id:'artists',
    src:artists,
    title:`鼎力支持的小画师们`,
    name:`鼎力支持的小画师们`,
    author:`吾之友`,
    summary:`还有梅花山链接`,
    artists:[
      {id:'446041',name:'白盛',avatar:baisheng,description:'福瑞画手，吾之友，鄙人所有PC之生父',href:'https://www.mihuashi.com/profiles/446041?role=painter'},
      {id:'154633',name:'钟理',avatar:zhongli,description:'卓尔爱好者，吾之友，任劳任怨之人',href:'https://www.mihuashi.com/profiles/154633?role=painter'}
    ]
  }
];
projects.sort((a,b)=>Number(b.id==='three-dragon')-Number(a.id==='three-dragon'));
const mobilePosters={'three-dragon':dragonMobile,kiwee:kiweeMobile,sealchat:sealchatMobile,'desktop-dice':diceMobile,musicboard:musicMobile,fulloffice:fullOffice,artists:artistsMobile};
projects.forEach(item=>{item.mobileSrc=mobilePosters[item.id]});
