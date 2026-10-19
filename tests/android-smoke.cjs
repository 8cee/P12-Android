const {chromium}=require('playwright');
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../app/src/main/assets');
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent(req.url.split('?')[0]);
 const file=path.join(root,name==='/'?'P-12.html':name);
 if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');let bytes=fs.readFileSync(file); if(file.endsWith('P-12.html'))bytes=Buffer.from(bytes.toString().replace('  setInterval(p12SyncPadControls,60);','  setInterval(p12SyncPadControls,60);window.__androidTest={state,audio:()=>ctx};'));res.end(bytes);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.P12_CHROMIUM,headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36',isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.saved=[];window.pending={};window.toasts=[];
  window.P12Android={beginSave:(id,name,mime)=>{pending[id]={name,mime,chunks:[]};return true;},appendSave:(id,c)=>{pending[id].chunks.push(c);return true;},finishSave:id=>{saved.push(pending[id]);delete pending[id];return true;},cancelSave:id=>{delete pending[id];},toast:m=>toasts.push(m),rotate:()=>window.rotated=true};
 });
 await page.route('https://fonts.googleapis.com/**',r=>r.abort());
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
 await page.waitForSelector('#p12MobileNav');
 await page.waitForTimeout(300);
 console.log('startup',await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,pads:document.querySelectorAll('.pad').length,nav:!!document.querySelector('#p12MobileNav')})));
 assert.equal(await page.locator('.pad').count(),8);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'phone layout must fit viewport');
 await page.screenshot({path:'/tmp/p12-phone-pads.png',fullPage:true});
 await page.locator('#pad-A_kick').tap();
 await page.waitForFunction(()=>window.__androidTest.audio()?.state==='running');
 assert.equal(await page.locator('.pad.p12-held').count(),0,'pad releases after touch');
 const pcm=Buffer.alloc(44+5208);pcm.write('RIFF');pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVEfmt ',8);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(1,22);pcm.writeUInt32LE(26040,24);pcm.writeUInt32LE(52080,28);pcm.writeUInt16LE(2,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(5208,40);for(let i=0;i<2604;i++)pcm.writeInt16LE(Math.round(Math.sin(i*.11)*15000),44+i*2);
 await page.locator('#pad-A_kick input[type=file]').setInputFiles({name:'Phone-test.wav',mimeType:'audio/wav',buffer:pcm});
 await page.waitForFunction(()=>!!window.__androidTest.state.samples.A_kick);

 await page.locator('[data-view="Sequencer"]').click();
 assert(await page.locator('.sequencer-panel').isVisible());
 await page.locator('.step').first().tap();
 await page.locator('#playBtn').tap();await page.waitForFunction(()=>window.__androidTest.state.playing);
 await page.locator('#stopBtn').tap();await page.waitForFunction(()=>!window.__androidTest.state.playing);

 const cdp=await page.context().newCDPSession(page);
 assert.equal(await page.locator('.track').first().locator('.step:visible').count(),8,'eight tappable steps per page');
 assert(await page.locator('.tracks-scroll').evaluate(e=>e.scrollWidth<=e.clientWidth+2),'sequencer fits without horizontal scrolling');
 await page.getByRole('button',{name:'Next steps',exact:true}).tap();
 assert.equal(await page.locator('.track').first().locator('.step:visible').first().getAttribute('data-tick'),'48');
 await page.locator('.track').first().locator('.step:visible').first().tap();
 assert(await page.locator('.track').first().locator('.step:visible').first().evaluate(e=>e.classList.contains('on')),'step on second page edits original cell');
 await page.getByRole('button',{name:'Previous steps',exact:true}).tap();
 await page.evaluate(()=>scrollTo(0,0));
 assert(await page.locator('.track').last().evaluate(e=>e.getBoundingClientRect().bottom<=document.getElementById('p12MobileTransportButtons').getBoundingClientRect().top),'all eight sequencer rows fit above transport');
 await page.screenshot({path:'/tmp/p12-phone-seq.png',fullPage:true});
 await page.locator('#p12LaneControls').tap();assert(await page.locator('.track').first().locator('.mute').isVisible());await page.locator('#p12LaneControls').tap();
 await page.locator('[data-view="Mixer"]').click();
 await page.waitForSelector('#mixerWinBackdrop',{state:'visible'});
 await page.waitForFunction(()=>document.querySelectorAll('.mpcstrip').length===42);
 assert.equal(await page.locator('.mpcstrip:visible').count(),4,'four faders at a time');
 await page.screenshot({path:'/tmp/p12-phone-mixer.png',fullPage:true});
 const banks=page.locator('.mobile-mixer-banks');
 await banks.getByRole('button',{name:'D',exact:true}).tap();
 await page.getByRole('button',{name:'Next mixer channels',exact:true}).tap();
 assert.equal(await page.locator('.mpcstrip:visible').last().getAttribute('data-native-index'),'31');
 const touchFader=page.locator('.mpcstrip:visible input.mpc-fader-input').first();
 const faderBounds=await touchFader.boundingBox();
 const touchBefore=await touchFader.inputValue();
 const x=faderBounds.x+faderBounds.width/2,y=faderBounds.y+faderBounds.height*.55;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let n=1;n<=8;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+n*8}]});await page.waitForTimeout(20);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.notEqual(await touchFader.inputValue(),touchBefore,'fader responds to touch drag');
 const fader=page.locator('.mpcstrip:visible input.mpc-fader-input').last();
 const fid=await page.locator('.mpcstrip:visible').last().getAttribute('data-fid');
 const oldVolume=await page.evaluate(fid=>window.__androidTest.state.vol[fid],fid);
 await fader.evaluate(e=>{e.value='0.5';e.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.notEqual(await page.evaluate(fid=>window.__androidTest.state.vol[fid],fid),oldVolume,'original audio volume changes');
 await page.locator('.mpcstrip:visible .mbtn').last().tap();assert(await page.evaluate(fid=>window.__androidTest.state.mute[fid],fid),'mute retains original state');
 await page.locator('.mpcstrip:visible .mobile-channel-details summary').last().tap();
 await page.waitForFunction(()=>document.querySelectorAll('.mobile-channel-expanded').length===1);
 assert.equal(await page.locator('.mpcstrip:visible').count(),1,'More opens a full width channel');
 assert(await page.locator('.mobile-channel-expanded .mpc-insert-select').first().isVisible());
 await page.getByRole('button',{name:'Back to faders',exact:true}).tap();assert.equal(await page.locator('.mpcstrip:visible').count(),4);
 await banks.getByRole('button',{name:'Tracks',exact:true}).tap();assert.equal(await page.locator('.mpcstrip:visible').count(),4);
 await banks.getByRole('button',{name:'Master',exact:true}).tap();assert(await page.locator('.mpcstrip-master').isVisible());
 await banks.getByRole('button',{name:'Buses',exact:true}).tap();assert(await page.locator('#mixerwinSubmixes').isVisible());
 assert(await page.evaluate(()=>window.p12AndroidBack()));
 await page.locator('[data-view="Song"]').click();
 await page.locator('#playlistToggleBtn').click();
 assert(await page.locator('#playlistDialog').isVisible());
 await page.evaluate(()=>window.p12AndroidBack());
 await page.locator('[data-view="FX"]').click();assert(await page.locator('#sslBusPanel').isVisible());
 await page.locator('[data-view="Pads"]').click();
 await page.locator('#p12MobileSettings summary').click();
 await page.locator('#saveProjectBtn').click();await page.waitForFunction(()=>saved.length>0);
 const saved=await page.evaluate(()=>window.saved[0]);
 const bytes=Buffer.concat(saved.chunks.map(c=>Buffer.from(c,'base64')));JSON.parse(bytes.toString());
 assert.equal(saved.name,'Project.p12');
 await page.locator('#loadProjectInput').setInputFiles({name:'Project.p12',mimeType:'application/octet-stream',buffer:bytes});
 await page.waitForFunction(()=>window.__androidTest.state.sampleNames.A_kick==='Phone-test.wav');
 await page.evaluate(()=>{const a=document.createElement('a');a.download='chunk-test.bin';const bytes=new Uint8Array(600001);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;a.href=URL.createObjectURL(new Blob([bytes]));a.click();URL.revokeObjectURL(a.href);});
 await page.waitForFunction(()=>saved.some(s=>s.name==='chunk-test.bin'));
 const chunks=await page.evaluate(()=>saved.find(s=>s.name==='chunk-test.bin').chunks);
 const output=Buffer.concat(chunks.map(c=>Buffer.from(c,'base64')));assert.equal(output.length,600001);for(let i=0;i<output.length;i++)assert.equal(output[i],i%251);
 await page.setViewportSize({width:844,height:390});await page.locator('[data-view="Pads"]').click();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'landscape fit');
 await page.screenshot({path:'/tmp/p12-phone-landscape.png',fullPage:true});
 await page.getByText('Rotate',{exact:true}).click();assert(await page.evaluate(()=>window.rotated));
 // Fit remains the default on every page; native pinch still works.
 await page.setViewportSize({width:390,height:844});
 for(const view of ['Pads','Sequencer','FX','Song']) {
   await page.locator('[data-view="'+view+'"]').click();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'screen fit '+view);
 }
 assert.equal(await page.locator('.p12-screen-zoom').count(),0,'no competing zoom toolbars');
 await page.locator('[data-view="Pads"]').click();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:160,y:400,id:1},{x:220,y:400,id:2}]});
 for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:160-i*5,y:400,id:1},{x:220+i*5,y:400,id:2}]});await page.waitForTimeout(30);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(300);
 assert(await page.evaluate(()=>visualViewport.scale>1.1),'two-finger pinch enlarges visual viewport');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>toasts),[]);
 console.log('PASS: fitted sequencer paging and banked mixer, two-finger pinch, phone portrait/landscape fit, 8 pads, sequencer zoom/scroll, Mixer-32 master, playlist, FX, Project.p12 save/load, detached-anchor chunk byte equality, rotate bridge, no script errors');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
