// Native WebGAL components remain responsible for navigation, saves and sound.
(() => {
  let knownTitle;
  let queued=false;
  function enhance() {
    if (knownTitle?.isConnected) return;
    const root=document.getElementById('root');
    if(!root) return;
    const title=[...root.querySelectorAll('div')].find(el=>getComputedStyle(el).getPropertyValue('--puretime-title').trim()==='1');
    if(!title) return;
    knownTitle=title;
    const column=[...title.querySelectorAll('div')].find(el=>getComputedStyle(el).getPropertyValue('--puretime-column').trim()==='1');
    for(const button of column?.children || []) {
      button.tabIndex=0;button.setAttribute('role','button');
      button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();button.click();}});
    }
    const subtitle=document.createElement('div');subtitle.className='puretime-subtitle';subtitle.textContent='无始无终之地 · 黄昏';title.append(subtitle);
    const link=document.createElement('a');link.className='puretime-credit';link.href='./credits.html';link.target='_blank';link.rel='noopener';link.textContent='作品信息 / 操作说明';title.append(link);
  }
  new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;enhance();});}}).observe(document.documentElement,{childList:true,subtree:true});
})();
