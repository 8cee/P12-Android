const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'FULL15_SOURCE.json')));
for(const [name,expected] of Object.entries(manifest.files)){
 let bytes=fs.readFileSync(path.join(root,'app/src/main/assets',name));
 if(name==='P-12.html'){let text=bytes.toString();for(const patch of JSON.parse(fs.readFileSync(path.join(root,'ANDROID_SOURCE_PATCHES.json')))){assert(text.includes(patch.android));text=text.replace(patch.android,patch.original);}bytes=Buffer.from(text);}
 if(name==='P-12.html')bytes=Buffer.from(bytes.toString().replace('<link rel="stylesheet" href="android.css">\n<script src="android.js"></script>\n',''));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected,name);
}
console.log('PASS: uploaded FULL15 source with explicitly recorded Android scheduling/render patches, HFE templates and ZIP engine; sampler/export implementation unchanged');
