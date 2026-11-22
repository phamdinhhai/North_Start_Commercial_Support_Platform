/** A separate interactive Chromium profile; never attaches to an Owner's browser. */
import {chromium} from '@playwright/test';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {status} from './preview.mjs';
const current=await status();if(!current.running)throw Error('Start the preview before opening its browser');
const root=resolve(process.env.R415_PRIVATE_ROOT??tmpdir());
const browser=await chromium.launchPersistentContext(join(root,'hybrid-preview','owner-browser-profile'),{channel:'chromium',headless:false,args:['--disable-extensions-except='+current.extensionDirectory,'--load-extension='+current.extensionDirectory]});
await browser.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname==='127.0.0.1'||url.protocol==='chrome-extension:'?route.continue():route.abort();});
const page=await browser.newPage();await page.goto(current.console);
await new Promise(done=>browser.once('close',done));
