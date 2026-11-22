export function validateRootDatabase(raw,applicationDatabase){
 let url;try{url=new URL(raw);}catch{throw Error('EXPLICIT_LOOPBACK_TEST_DATABASE_REQUIRED');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='127.0.0.1'||!url.port||url.search||url.hash||applicationDatabase)throw Error('EXPLICIT_LOOPBACK_TEST_DATABASE_REQUIRED');
 return url;
}
export function fixtureDatabaseName(value){if(!/^qa_browser_r414_[a-f0-9]{10}$/.test(value))throw Error('GENERATED_DATABASE_NAME_REQUIRED');return value;}
