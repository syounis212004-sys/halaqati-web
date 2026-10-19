/* Halaqati v2.17.2 — navigation/render runtime with smart plans and notification center. */
function toggleDrawer(v){let d=$('#drawer'),b=$('#backdrop');d?.classList.toggle('open',v);b?.classList.toggle('open',v);d?.setAttribute('aria-hidden',(v||document.documentElement.getAttribute('data-view')==='desktop')?'false':'true');if(v){window.halaqatiDrawerFocus=document.activeElement;d?.querySelector('button')?.focus()}else if(document.documentElement.getAttribute('data-view')!=='desktop'){window.halaqatiDrawerFocus?.focus?.()}}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#drawer')?.classList.contains('open'))toggleDrawer(false)});
function isOwner(){return state.profile?.role==='admin'}
function isSupervisor(){return state.profile?.role==='supervisor'}
function roleCanManage(){return ['admin','supervisor','teacher'].includes(state.profile?.role)}
function roleCanAdmin(){return ['admin','supervisor'].includes(state.profile?.role)}
function canManageStudents(){return ['admin','supervisor','teacher'].includes(state.profile?.role)}
function canManageUsers(){return isOwner()}
function navSvg(p){
  const paths={
    home:'<path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
    notifications:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    halaqas:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    community:'<path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4.5A8.5 8.5 0 1 1 21 12Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',
    sessions:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/>',
    students:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    plans:'<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h3"/><path d="m14 16 1.4 1.4L18 14.8"/>',
    certificates:'<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/><path d="m16 15 1.5 1 2.5-3"/>',
    reports:'<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/>',
    quran:'<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23Z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23Z"/>',
    ranking:'<path d="M8 21h8M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0Z"/><path d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4"/>',
    competition:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    supervision:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    users:'<circle cx="9" cy="8" r="3.5"/><path d="M3 21v-2a6 6 0 0 1 12 0v2"/><path d="m17 11 2 2 3-4"/>',
    data:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.4.3.8.7 1 1 .2.3.4.7.4 1.1v.1h.2v4h-.1A1.7 1.7 0 0 0 19.4 15Z"/>',
    profile:'<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',
    more:'<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[p]||paths.more}</svg>`
}
function iconFor(p){return navSvg(p)}
function navItems(){let r=state.profile?.role;let nt=['notifications',`الإشعارات${state.notificationUnread?` (${state.notificationUnread})`:''}`],common=[['home','الرئيسية'],nt,['community','الإعلانات ومنتدى الحلقة']];if(r==='admin')return [['home','الرئيسية'],nt,['halaqas','إدارة الحلقات والفئات'],['community','الإعلانات ومنتدى الحلقة'],['sessions','الجلسات اليومية'],['students','الطلاب'],['plans','الخطط الذكية'],['certificates','الشهادات'],['reports','التقارير'],['quran','حاسبة القرآن'],['ranking','الترتيب والإحصائيات'],['data','الاستيراد والتصدير'],['supervision','متابعة المحفّظ'],['users','الحسابات والصلاحيات'],['settings','الإعدادات']];if(r==='supervisor')return [...common,['halaqas','الحلقات والفئات'],['sessions','الجلسات اليومية'],['students','الطلاب'],['plans','الخطط الذكية'],['certificates','الشهادات'],['reports','التقارير'],['quran','حاسبة القرآن'],['ranking','الترتيب والإحصائيات'],['data','الاستيراد والتصدير'],['supervision','متابعة المحفّظ'],['settings','الإعدادات']];if(r==='teacher')return [...common,['halaqas','حلقتي والفئات'],['sessions','الجلسات اليومية'],['students','طلابي'],['plans','الخطط الذكية'],['certificates','الشهادات'],['reports','التقارير'],['quran','حاسبة القرآن'],['ranking','الترتيب والإحصائيات'],['data','تصدير البيانات'],['settings','الإعدادات']];if(r==='guardian')return [...common,['plans','خطط أبنائي الذكية'],['reports','تقارير أبنائي'],['competition','إحصائيات ومنافسة'],['ranking','الإنجازات'],['profile','ملف الطالب'],['settings','الإعدادات']];return common;}
function mobileNavItems(){
  let r=state.profile?.role;
  if(r==='guardian')return [['home','الرئيسية'],['reports','التقارير'],['plans','الخطط'],['profile','الطالب'],['more','المزيد']];
  return [['home','الرئيسية'],['sessions','الجلسات'],['students','الطلاب'],['plans','الخطط'],['more','المزيد']]
}
function buildMobileNav(){
  let n=$('#mobileNav');if(!n)return;
  let items=mobileNavItems(),core=new Set(items.filter(x=>x[0]!=='more').map(x=>x[0])),moreActive=!core.has(state.page);
  n.innerHTML=items.map(([p,l])=>{
    let active=p==='more'?moreActive:state.page===p,action=p==='more'?"toggleDrawer(true)":`go('${p}')`;
    return `<button type="button" class="${active?'active':''}" aria-label="${l}" ${active?'aria-current="page"':''} onclick="${action}"><span class="mobile-nav-icon">${navSvg(p)}</span><span>${l}</span></button>`
  }).join('')
}
function buildNav(){let n=$('#nav');n.innerHTML=navItems().map(([p,l])=>`<button type="button" class="${state.page===p?'active':''}" ${state.page===p?'aria-current="page"':''} onclick="go('${p}')"><span class="ico">${iconFor(p)}</span><span>${l}</span></button>`).join('');buildMobileNav()}
function go(p){if(p!=='sessions')state.sessionView=null;state.page=p;toggleDrawer(false);render()}
function setFab(){let f=$('#fab');f.classList.add('hidden');if(state.page==='halaqas'&&isOwner()){f.classList.remove('hidden');f.dataset.action='halaqa'}if(state.page==='sessions'&&roleCanManage()){f.classList.remove('hidden');f.dataset.action='session'}if(state.page==='students'&&canManageStudents()){f.classList.remove('hidden');f.dataset.action='student'}if(state.page==='community'&&roleCanManage()){f.classList.remove('hidden');f.dataset.action=state.communityTab==='forum'?'forum':'announcement'}if(state.page==='plans'&&roleCanManage()){f.classList.remove('hidden');f.dataset.action='plan'}}
function fabAction(){let a=$('#fab').dataset.action;if(a==='halaqa')openHalaqa();if(a==='session')openSession();if(a==='student')openStudent();if(a==='announcement')openAnnouncement();if(a==='forum')openForum();if(a==='plan')openPlan()}
async function render(){if(state.profile?.role==='guardian'&&state.networkVerified){if(state.page==='competition')await ensureGuardianCompetition();if(state.page==='ranking')await ensureGuardianRangeRanks();}buildNav();setFab();let titles={home:'الرئيسية',halaqas:'الحلقات والفئات',community:'الإعلانات ومنتدى الحلقة',notifications:'الإشعارات',sessions:'الجلسات اليومية',students:'الطلاب',plans:'الخطط الذكية',reports:'التقارير',certificates:'الشهادات',competition:'إحصائيات ومنافسة',quran:'حاسبة القرآن',ranking:'الترتيب والإحصائيات',data:'الاستيراد والتصدير',settings:'الإعدادات',supervision:'متابعة المحفّظ',users:'المستخدمون',profile:'ملف الطالب'};$('#pageTitle').textContent=titles[state.page]||'حلقتي';let html='';if(state.page==='home')html=homePage();if(state.page==='halaqas')html=halaqasPage();if(state.page==='community')html=communityPage();if(state.page==='notifications')html=notificationsPage();if(state.page==='sessions')html=sessionsPage();if(state.page==='students')html=studentsPage();if(state.page==='plans')html=plansPage();if(state.page==='reports')html=reportsPage();if(state.page==='certificates')html=certificatesPage();if(state.page==='competition')html=guardianCompetitionPage();if(state.page==='quran')html=quranPage();if(state.page==='ranking')html=rankingPage();if(state.page==='data')html=dataPage();if(state.page==='settings')html=settingsPage();if(state.page==='supervision')html=supervisionPage();if(state.page==='users')html=await usersPage();if(state.page==='profile')html=profilePage();$('#content').innerHTML=html}

window.addEventListener('halaqati:viewchange',()=>{const d=document.getElementById('drawer');d?.setAttribute('aria-hidden',(document.documentElement.getAttribute('data-view')==='desktop'||d.classList.contains('open'))?'false':'true')});
document.addEventListener('keydown',e=>{const d=document.getElementById('drawer');if(!d?.classList.contains('open')||document.documentElement.getAttribute('data-view')==='desktop')return;if(e.key==='Escape'){toggleDrawer(false);e.preventDefault()}if(e.key==='Tab'){const items=[...d.querySelectorAll('button,a[href],input,select')].filter(x=>x.offsetParent!==null&&!x.disabled);if(!items.length)return;const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
