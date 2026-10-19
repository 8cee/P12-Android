/* Android-only shell; FULL15's sampler and SP-1200 conversion remain unchanged. */
(() => {
  'use strict';
  if (!window.P12Android) return;
  const bridge = window.P12Android;
  const blobs = new Map();
  const createURL = URL.createObjectURL.bind(URL), revokeURL = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => { const url = createURL(blob); blobs.set(url, blob); return url; };
  URL.revokeObjectURL = url => { blobs.delete(url); revokeURL(url); };
  let queue = Promise.resolve();
  function download(anchor) {
    if (!anchor.download || !anchor.href.startsWith('blob:')) return false;
    // Capture synchronously, before the exporter revokes its object URL.
    const blob = blobs.get(anchor.href);
    const source = blob ? Promise.resolve(blob) : fetch(anchor.href).then(r => r.blob());
    source.catch(() => {});
    let name = anchor.download;
    if (/\.p12proj(?:\.json)?$/i.test(name) || /^p12-project-/i.test(name)) name = 'Project.p12';
    queue = queue.then(async () => {
      const id = Date.now() + '-' + Math.random();
      try {
        const data = await source;
        if (!bridge.beginSave(id, name, data.type || 'application/octet-stream')) throw Error('Cannot start export');
        for (let start = 0; start < data.size; start += 192 * 1024) {
          const bytes = new Uint8Array(await data.slice(start, start + 192 * 1024).arrayBuffer());
          let binary = '';
          for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          if (!bridge.appendSave(id, btoa(binary))) throw Error('Cannot write export');
        }
        if (!bridge.finishSave(id)) throw Error('Cannot finish export');
      } catch (error) { bridge.cancelSave(id); bridge.toast('Save failed: ' + error.message); }
    });
    return true;
  }
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (!download(this)) return click.call(this); };
  document.addEventListener('click', event => {
    const anchor = event.target.closest && event.target.closest('a[download]');
    if (anchor && download(anchor)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('DOMContentLoaded', () => {
    const viewport = document.querySelector('meta[name=viewport]');
    if (viewport) viewport.content = 'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=3,user-scalable=yes,viewport-fit=cover';
    // Move the original controls (and their listeners), never clone sampler state.
    const unit = document.querySelector('.unit');
    const header = document.querySelector('.topbar');
    const transport = document.querySelector('.transport');
    const common = document.createElement('div'); common.id = 'p12MobileTransport';
    common.append(document.querySelector('.lcd'));
    const controls = document.createElement('div'); controls.className = 'mobile-play-controls'; controls.id='p12MobileTransportButtons';
    for (const id of ['playBtn','stopBtn','liveRecBtn']) controls.append(document.getElementById(id));
    const tempo=document.createElement('label');tempo.className='mobile-tempo';tempo.textContent='BPM ';tempo.append(document.getElementById('tempoInput'),document.getElementById('tempoSetBtn'),document.getElementById('tapBtn'));common.append(tempo);
    common.append(document.querySelector('.bank-row')); document.body.append(controls);
    const settings = document.createElement('details'); settings.id = 'p12MobileSettings';
    const summary = document.createElement('summary'); summary.textContent = 'Project & sequence settings'; settings.append(summary,transport);
    const pages = {};
    for (const name of ['Pads','Sequencer','FX','Song']) {
      const page = document.createElement('section'); page.className='p12-mobile-page'; page.dataset.page=name;
      pages[name]=page;
    }
    pages.Pads.append(document.querySelector('.pads-panel'));
    const padSettings = document.createElement('details'); padSettings.className='mobile-pad-settings';
    const padSummary = document.createElement('summary'); padSummary.textContent='Pad tune, level & routing';
    padSettings.append(padSummary,document.querySelector('.mixer-panel')); pages.Pads.append(padSettings);
    pages.Sequencer.append(document.querySelector('.sequencer-panel'));
    const song = document.getElementById('songPanel'); if(song) pages.Song.append(song);
    for(const panel of [...document.querySelectorAll('.fx-panel')]) if(panel !== song) pages.FX.append(panel);
    unit.prepend(header,common,settings,...Object.values(pages));
    // Empty desktop layout containers no longer participate in phone layout.
    for(const wrapper of unit.querySelectorAll(':scope > .main-layout,:scope > .bottom-row,:scope > footer')) wrapper.style.display='none';
    const nav = document.createElement('nav'); nav.id = 'p12MobileNav'; nav.setAttribute('aria-label', 'P-12 views');
    let current = 'Pads';
    function select(name) {
      current = name;
      document.documentElement.classList.toggle('p12-mobile-seq', name === 'Sequencer');
      for(const [key,page] of Object.entries(pages)) page.hidden = key !== (name === 'Mixer' ? 'Pads' : name);
      settings.open=false;
      if (name === 'Mixer') document.getElementById('mixerWinBtn')?.click();
      window.scrollTo({top:0,left:0});
      for (const b of nav.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === name));
    }
    for (const name of ['Pads', 'Sequencer', 'Mixer', 'FX', 'Song']) {
      const button = document.createElement('button'); button.textContent = name; button.dataset.view = name;
      button.addEventListener('click', () => select(name)); nav.appendChild(button);
    }
    const rotate = document.createElement('button'); rotate.textContent = 'Rotate'; rotate.onclick = () => bridge.rotate(); header.appendChild(rotate);
    header.after(nav);
    const tools = document.createElement('details'); tools.className='mobile-pad-tools';
    const toolsTitle=document.createElement('summary'); toolsTitle.textContent='Sample tools · Chop · 8 Levels'; tools.append(toolsTitle);
    const toolbar=document.querySelector('.pads-toolbar');
    const actions=toolbar.lastElementChild; tools.append(actions); toolbar.replaceWith(tools);
    const edit=document.createElement('button');edit.textContent='Edit pads'; edit.id='p12EditPads';edit.setAttribute('aria-pressed','false');
    edit.onclick=()=>{const on=document.documentElement.classList.toggle('p12-edit-pads');edit.setAttribute('aria-pressed',String(on));edit.textContent=on?'Done editing':'Edit pads';};
    pages.Pads.querySelector('.pads-panel').append(edit);
    const dock=document.getElementById('p12VstChordDock'); if(dock) settings.append(dock);
    const upgrades=document.getElementById('upgradeDock'); if(upgrades) settings.append(upgrades);
    const seqPanel = pages.Sequencer.querySelector('.sequencer-panel');
    const help = document.createElement('details'); help.className='mobile-seq-help';
    const helpTitle=document.createElement('summary');helpTitle.textContent='Sequencer help';
    help.append(helpTitle,seqPanel.querySelector('.section-label'));seqPanel.prepend(help);
    const seqScroller=seqPanel.querySelector('.tracks-scroll');
    const tracks=document.getElementById('tracks');
    const pager=document.createElement('div');pager.className='mobile-seq-pager';
    const previousSteps=document.createElement('button'),nextSteps=document.createElement('button'),stepRange=document.createElement('span');
    previousSteps.textContent='◀';nextSteps.textContent='▶';previousSteps.setAttribute('aria-label','Previous steps');nextSteps.setAttribute('aria-label','Next steps');
    pager.append(previousSteps,document.getElementById('seqBarJump'),stepRange,nextSteps);seqScroller.before(pager);
    const laneControls=document.createElement('button');laneControls.id='p12LaneControls';laneControls.textContent='Lane controls';laneControls.setAttribute('aria-expanded','false');
    laneControls.onclick=()=>{const on=seqPanel.classList.toggle('mobile-lane-controls');laneControls.setAttribute('aria-expanded',String(on));laneControls.textContent=on?'Done':'Lane controls';};seqScroller.after(laneControls);
    seqPanel.append(help);
    let stepPage=0;
    function sizeRows() {
      const rows=[...tracks.children].filter(row=>row.matches('.track,.step-ruler'));
      const count=rows[0]?.children.length-1||0;
      stepPage=Math.max(0,Math.min(stepPage,Math.ceil(count/8)-1));
      const first=stepPage*8,last=Math.min(count,first+8);
      for(const row of rows) {
        if(row.style.gridTemplateColumns!=='32px repeat(8, minmax(0px, 1fr))')row.style.setProperty('grid-template-columns','32px repeat(8,minmax(0,1fr))','important');
        [...row.children].forEach((cell,i)=>{if(i){const hidden=i-1<first||i-1>=last;if(cell.classList.contains('mobile-step-hidden')!==hidden)cell.classList.toggle('mobile-step-hidden',hidden);}});
      }
      const tick=Number(rows[0]?.children[first+1]?.dataset.tick)||0;
      stepRange.textContent='Bar '+(Math.floor(tick/96)+1)+' · '+(first+1)+'–'+last;
      previousSteps.disabled=stepPage===0;nextSteps.disabled=last>=count;
      seqScroller.scrollLeft=0;
    }
    previousSteps.onclick=()=>{stepPage--;sizeRows();};nextSteps.onclick=()=>{stepPage++;sizeRows();};
    document.getElementById('seqBarJump').addEventListener('change',event=>{
      const cells=[...tracks.querySelectorAll('.step-ruler > [data-tick]')];
      const index=cells.findIndex(cell=>Number(cell.dataset.tick)>=Number(event.target.value)*96);
      stepPage=Math.floor(Math.max(0,index)/8);sizeRows();
    });
    sizeRows();new MutationObserver(sizeRows).observe(tracks,{childList:true});
    window.p12AndroidShouldPaintSequencer=()=>current==='Sequencer' && !document.hidden;
    window.p12AndroidPlayhead=idx=>{
      if(!window.p12AndroidShouldPaintSequencer())return;
      const cells=tracks.querySelector('.track')?.querySelectorAll('.step');
      if(!cells)return;
      const tick=idx*6;let position=0;
      while(position+1<cells.length&&Number(cells[position+1].dataset.tick)<=tick)position++;
      const nextPage=Math.floor(position/8);
      if(nextPage!==stepPage){stepPage=nextPage;sizeRows();}
    };
    // Four original channel strips at a time. All controls keep their original handlers.
    const mixer=document.getElementById('mixerWinBackdrop');
    const workspace=mixer.querySelector('.mixerwin-scroll');
    const mixerHeader=mixer.querySelector('.modal-header .section-label');if(mixerHeader)mixerHeader.textContent='Mixer';
    document.getElementById('mixerWinCloseBtn').textContent='Done';
    const banks=document.createElement('div');banks.className='mobile-mixer-banks';banks.setAttribute('aria-label','Mixer banks');
    const mixerPager=document.createElement('div');mixerPager.className='mobile-mixer-pager';
    const prev=document.createElement('button'),next=document.createElement('button'),range=document.createElement('span'),back=document.createElement('button');
    prev.textContent='◀';next.textContent='▶';back.textContent='Back to faders';prev.setAttribute('aria-label','Previous mixer channels');next.setAttribute('aria-label','Next mixer channels');
    mixerPager.append(prev,range,next,back);workspace.before(banks,mixerPager);
    let mixerBank='A',mixerPage=0,detailKey=null;
    const keyOf=strip=>strip.dataset.nativeKind+':'+strip.dataset.nativeIndex;
    function updateMixer() {
      const strips=[...workspace.querySelectorAll('.mpcstrip')];
      for(const strip of strips) {
        if(!strip.querySelector('.mobile-channel-details')) {
          const details=document.createElement('details');details.className='mobile-channel-details';
          const title=document.createElement('summary');title.textContent='More';details.append(title);
          for(const child of [...strip.children])if(!child.matches('.mpc-channel-id,.mpc-ms-row,.mpc-fader-area,.mpc-fader-readout'))details.append(child);
          strip.append(details);
          details.addEventListener('toggle',()=>{
            if(details.open&&detailKey!==keyOf(strip)){detailKey=keyOf(strip);updateMixer();workspace.scrollTop=0;}
            else if(!details.open&&detailKey===keyOf(strip)){detailKey=null;updateMixer();}
          });
        }
      }
      const filtered=strips.filter(strip=>mixerBank==='Master'?strip.dataset.nativeKind==='master':mixerBank==='Tracks'?strip.dataset.nativeKind==='track':strip.dataset.nativeKind==='pad'&&strip.dataset.fid?.startsWith(mixerBank+'_'));
      mixerPage=Math.min(mixerPage,Math.max(0,Math.ceil(filtered.length/4)-1));
      const visible=detailKey?strips.filter(s=>keyOf(s)===detailKey):filtered.slice(mixerPage*4,mixerPage*4+4);
      for(const strip of strips){strip.classList.toggle('mobile-mixer-hidden',!visible.includes(strip));strip.classList.toggle('mobile-channel-expanded',detailKey===keyOf(strip));if(detailKey!==keyOf(strip))strip.querySelector('.mobile-channel-details').open=false;}
      workspace.classList.toggle('mobile-mixer-detail',!!detailKey);
      for(const row of workspace.querySelectorAll('.mixerwin-row-scroll'))row.classList.toggle('mobile-mixer-hidden',row.querySelector('#mixerwinSubmixes')?mixerBank!=='Buses':![...row.querySelectorAll('.mpcstrip')].some(s=>visible.includes(s)));
      for(const label of workspace.querySelectorAll('.mixerwin-section-label'))label.classList.add('mobile-mixer-hidden');
      range.textContent=mixerBank==='Master'?'Master':mixerBank==='Buses'?'Subchannels':mixerBank+' · '+(mixerPage*4+1)+'–'+Math.min(filtered.length,mixerPage*4+4);
      prev.hidden=next.hidden=!!detailKey||filtered.length<=4;range.hidden=!!detailKey;back.hidden=!detailKey;
      prev.disabled=mixerPage===0;next.disabled=(mixerPage+1)*4>=filtered.length;
      for(const b of banks.children)b.setAttribute('aria-pressed',String(b.dataset.bank===mixerBank));
    }
    for(const name of ['A','B','C','D','Tracks','Master','Buses']){
      const b=document.createElement('button');b.textContent=name;b.dataset.bank=name;b.onclick=()=>{mixerBank=name;mixerPage=0;detailKey=null;updateMixer();workspace.scrollTop=0;};banks.append(b);
    }
    prev.onclick=()=>{mixerPage--;updateMixer();};next.onclick=()=>{mixerPage++;updateMixer();};back.onclick=()=>{detailKey=null;updateMixer();workspace.scrollTop=0;};
    for(const id of ['mixerwinStrips','mixerwinTrackStrips'])new MutationObserver(updateMixer).observe(document.getElementById(id),{childList:true});
    updateMixer();
    window.p12AndroidBack = () => {
      const dialog = document.querySelector('dialog[open]'); if (dialog) { dialog.close(); return true; }
      const dialogs = [...document.querySelectorAll('.modal-backdrop')].filter(d => getComputedStyle(d).display !== 'none');
      dialogs.sort((a,b) => (parseInt(getComputedStyle(a).zIndex)||0) - (parseInt(getComputedStyle(b).zIndex)||0));
      const close = dialogs.pop()?.querySelector('button[id*="Close"],button[id*="close"]');
      if (close) { close.click(); return true; }
      if(settings.open) { settings.open=false; return true; }
      if (current !== 'Pads') { select('Pads'); return true; } return false;
    };
    // Document providers do not consistently understand .p12/.sp12/.hfe MIME types.
    document.querySelectorAll('input[type=file]').forEach(input => { if (/\.p12|\.sp12|\.hfe|application\/json/.test(input.accept)) input.accept = '*/*'; });
    // Fit by default; pinch can enlarge and return to the fitted view.
    document.documentElement.style.setProperty('--p12-ui-zoom','1');
    try { localStorage.removeItem('p12-phone-zoom'); } catch (_) {}
    function setupDialogs() {
      document.querySelectorAll('.modal-backdrop,dialog').forEach(dialog=>{if(dialog.closest('.unit'))document.body.append(dialog);});
    }
    setupDialogs();
    unit.append(settings);
    pages.Pads.querySelector('.pads-panel').append(tools);
    // Two-finger gestures own navigation; individual controls keep one-finger input.
    let gesture=null,suppressClickUntil=0;
    const activePointers=new Map();
    document.addEventListener('pointerdown',event=>{
      if(event.pointerType!=='touch')return;
      if(activePointers.size){event.stopImmediatePropagation();}
      activePointers.set(event.pointerId,event.target);
    },true);
    for(const type of ['pointerup','pointercancel'])document.addEventListener(type,event=>activePointers.delete(event.pointerId),true);
    const measure=touches=>({x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2,d:Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY)});
    function scrollChain(target,dx,dy){
      let x=dx,y=dy;
      for(let el=target instanceof Element?target:target.parentElement;el&&el!==document.body;el=el.parentElement){
        const style=getComputedStyle(el);
        const left=el.scrollLeft,top=el.scrollTop;
        if(/auto|scroll/.test(style.overflowX))el.scrollLeft+=x;
        if(/auto|scroll/.test(style.overflowY))el.scrollTop+=y;
        x-=el.scrollLeft-left;y-=el.scrollTop-top;
      }
      if(bridge.scrollPage)bridge.scrollPage(x,y);else window.scrollBy(x,y);
    }
    document.addEventListener('touchstart',event=>{
      if(event.touches.length!==2)return;
      event.preventDefault();
      const p=measure(event.touches);gesture={start:p,last:p,target:event.target,mode:null};
      for(const [id,target] of [...activePointers]){
        target.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:id,pointerType:'touch'}));
        try{if(target.hasPointerCapture(id))target.releasePointerCapture(id);}catch(_){}
      }
      suppressClickUntil=performance.now()+600;
    },{capture:true,passive:false});
    document.addEventListener('touchmove',event=>{
      if(!gesture||event.touches.length!==2)return;
      event.preventDefault();event.stopPropagation();
      const p=measure(event.touches),g=gesture;
      const travel=Math.hypot(p.x-g.start.x,p.y-g.start.y),spread=Math.abs(p.d-g.start.d);
      if(!g.mode){if(spread>12&&spread>travel*1.25)g.mode='zoom';else if(travel>8)g.mode='scroll';}
      if(g.mode==='scroll')scrollChain(g.target,g.last.x-p.x,g.last.y-p.y);
      else if(g.mode==='zoom'&&bridge.zoomBy)bridge.zoomBy(Math.max(.8,Math.min(1.25,p.d/Math.max(1,g.last.d))));
      g.last=p;suppressClickUntil=performance.now()+600;
    },{capture:true,passive:false});
    for(const type of ['touchend','touchcancel'])document.addEventListener(type,event=>{
      if(gesture){event.preventDefault();suppressClickUntil=performance.now()+600;if(event.touches.length<2)gesture=null;}
    },{capture:true,passive:false});
    document.addEventListener('click',event=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
    const gestureHint=document.createElement('div');gestureHint.className='mobile-gesture-hint';gestureHint.textContent='Two fingers: scroll · Pinch: zoom';settings.append(gestureHint);
    select('Pads');
  }, {once:true});
})();
