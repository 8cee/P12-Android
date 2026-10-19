// Exercise the actual file:// origin used by Android, not an HTTP test server.
const {chromium}=require('playwright'),path=require('path'),assert=require('assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.P12_CHROMIUM,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});try{
 const page=await browser.newPage({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36',isMobile:true,hasTouch:true});
 await page.addInitScript(()=>{
  window.modules=[];window.fallbacks=0;window.worklets=0;
  const Original=window.AudioContext;
  window.AudioContext=class extends Original{constructor(...args){super(...args);const add=this.audioWorklet.addModule.bind(this.audioWorklet);this.audioWorklet.addModule=async(url,...args)=>{try{await add(url,...args);modules.push({ok:true,data:url.startsWith('data:')});}catch(e){modules.push({ok:false,error:e.message});throw e;}};}};
  const processor=Original.prototype.createScriptProcessor;Original.prototype.createScriptProcessor=function(...args){fallbacks++;return processor.apply(this,args);};
  const Worklet=window.AudioWorkletNode;window.AudioWorkletNode=class extends Worklet{constructor(...args){super(...args);worklets++;}};
  window.P12Android={toast:()=>{},rotate:()=>{}};
 });
 await page.route('https://fonts.googleapis.com/**',r=>r.abort());
 await page.goto('file://'+path.resolve(__dirname,'../app/src/main/assets/P-12.html'));
 await page.locator('.pad').first().tap();await page.waitForFunction(()=>modules.length>0);
 assert.deepEqual(await page.evaluate(()=>modules),[{ok:true,data:true}]);
 const pcm=Buffer.alloc(44+5208);pcm.write('RIFF');pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVEfmt ',8);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(1,22);pcm.writeUInt32LE(26040,24);pcm.writeUInt32LE(52080,28);pcm.writeUInt16LE(2,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(5208,40);for(let i=0;i<2604;i++)pcm.writeInt16LE(Math.round(Math.sin(i*.11)*15000),44+i*2);
 await page.locator('#pad-A_kick input[type=file]').setInputFiles({name:'test.wav',mimeType:'audio/wav',buffer:pcm});await page.waitForTimeout(300);await page.locator('#pad-A_kick').tap();
 assert.equal(await page.evaluate(()=>fallbacks),0,'no main-thread ScriptProcessor fallback');
 console.log('PASS: local-file audio worklet loads successfully; no ScriptProcessor fallback');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
