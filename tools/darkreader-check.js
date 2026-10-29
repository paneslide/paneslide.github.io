// Dark Reader simulation (npm darkreader, install with: npm i --prefix /tmp/dr darkreader@4).
// 1) With our darkreader-lock meta Dark Reader must stay off. 2) Even with the lock stripped,
// the board and target (canvas) must keep their true colours.
const pw=require(process.env.PW || "playwright-core");
(async()=>{const b=await pw.chromium.launch({executablePath:"/usr/bin/google-chrome",args:["--no-sandbox"]});
for (const lock of [true,false]) {
const c=await b.newContext({viewport:{width:390,height:844},colorScheme:"dark"});const p=await c.newPage();
if(!lock) await p.route("**/index.html*", r=>r.continue()); 
await p.addInitScript({path:"/tmp/dr/node_modules/darkreader/darkreader.js"});
if(!lock) await p.route(/\/(\?.*)?$/, async r=>{const res=await r.fetch();let body=(await res.text()).replace('<meta name="darkreader-lock">','');r.fulfill({response:res,body});});
await p.goto("http://127.0.0.1:8765/?test=1&level=5&tutorial=0",{waitUntil:"networkidle"});
await p.evaluate(()=>DarkReader.enable({brightness:100,contrast:90,sepia:10}));await p.waitForTimeout(1500);
console.log("lock",lock, await p.evaluate(()=>({drStyles:document.querySelectorAll("style.darkreader").length, hudBg:getComputedStyle(document.querySelector(".hud .pill, .hud button")||document.body).backgroundColor, bodyBg:getComputedStyle(document.body).backgroundImage.slice(0,60)})));
await p.screenshot({path:__dirname + "/../screenshots/level5-darkreader-"+(lock?"locked":"nolock")+".png"});
await c.close();}
await b.close();})();
