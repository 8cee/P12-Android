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
    if (viewport) viewport.content = 'width=device-width,initial-scale=1,minimum-scale=0.25,maximum-scale=5,user-scalable=yes,viewport-fit=cover';
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
    const tracks = document.getElementById('tracks');
    function sizeRows() {
      for (const row of tracks.children) if (row.matches('.track,.step-ruler'))
        row.style.setProperty('grid-template-columns', `128px repeat(${row.children.length - 1}, var(--seq-step-min,28px))`, 'important');
    }
    sizeRows(); new MutationObserver(sizeRows).observe(tracks, {childList:true});
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
    select('Pads');
  }, {once:true});
})();
