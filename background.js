import "./js/keepAlive.js"
import { Browser } from "./js/browser.js"
import { Settings } from "./js/settings.js"
import { Config } from "./js/Config.js"
import { StreamClientController } from "./js/streamingService.js"
import { GetI18nText, IsStrWithVal, PromiseAll } from "./js/utils.js"
import { NamedStreamData, StreamInfo, TypedStreamData } from "./js/streamingServices/GenericStreamClient.js"

const STORAGE_ID = "BACKGROUND"
const UPDATE_STREAMS_ID = "BACKGROUND_UPDATER"
const UPDATE_AWAITER_ID = "BACKGROUND_AWAITER"
const UPDATE_INTERVAL_KEY = "updateInterval"
const FIRE_ON_WAKE = "fireOnWake"
const MERGE_SAME_NAME = "mergeSameName"
const NOTIFICATIONS = "notifications"
const ACTIVE_STREAMS_KEY = "ActiveStreams"
const LAST_UPDATE_KEY = "LastUpdate"
const UPDATE_TIMEOUT = 1000

/**
 * @type {Settings}
 */
let SETTINGS = null
/**
 * @type {StreamClientController}
 */
let ACCOUNTS_CONTROLLER = null

if(!Browser.Alarms.onAlarm.hasListeners())
	Browser.Alarms.onAlarm.addListener(OnAlarm)

Browser.OnActiveStateChanged(OnActiveStateChanged)
Browser.OnStorageStateChanged(_OnStorageChanged)
//console.log(self.navigator, self.ononline)
//self.ononline = ()=>console.warn("ONLINE!")
//self.navigator.addEventListener('offline', ()=>console.warn("OFFLINE!"))
OnStart()

/* *********************************************************************************************************** */

async function _OnStorageChanged(changes){
	console.log("STORAGE", changes)
}

async function OnStart(){ // ASYNC STARTUP FUNC
	try{
		console.log("START")
		SETTINGS ??= await GetSettingsInstance()
		SETTINGS.OnUpdate(OnSettingsUpdate)
		
		ACCOUNTS_CONTROLLER ??= await StreamClientController.Create()
		//ACCOUNTS_CONTROLLER.OnStreamCacheUpdate(OnStreamCacheUpdate) // {}, {Bander:false, GB:false} // stream cache
		ACCOUNTS_CONTROLLER.OnUpdate(OnClientIDsUpdate) // [], ['1849ffac-add2-460b-af8d-af480f73eabe'] // client IDs?
		await PromiseAll([
			TryEnableAlarm(false), 
			UpdateBadge()
		])
	}catch(e){
		console.error(e)
	}
}

async function OnActiveStateChanged(isActive=false){
	console.log("ACTIVE STATE", isActive)
	return isActive ? TryEnableAlarm(undefined, true) : TryDisableAlarm()
}

async function OnAlarm(alarm){
	switch (alarm.name) {
		case UPDATE_STREAMS_ID:
			console.log("ALARM", UPDATE_STREAMS_ID)

			if(IsOnline()){
				console.log("starting update")
				await Browser.Lock(UPDATE_STREAMS_ID, UpdateCurrentStreamers)
				console.log("finishing update")
				//SetUpdateAlarm() // to catch any changes that might've been missed, don't care when this completes
				//UpdateBadge() // don't care when this completes
			}else{
				console.log("cannot execute update, not online")
			}
		default:
			console.log("UNKNOWN ALARM", alarm)
	}
}

async function OnStreamCacheUpdate(cache){
	console.log("STREAM CACHE", cache)
	try{
		 // TODO: can I do notifications here somehow?
		await UpdateBadge()
	}catch(e){
		console.warn(e)
	}
}

async function OnClientIDsUpdate(ids){ // TODO ?
	console.log("CLIENT IDS UPDATE")
	try{
		if(ids.length > 0){
			await TryEnableAlarm()
		}else{
			await TryDisableAlarm()
		}
	}catch(e){
		console.warn(e)
	}
}

async function OnSettingsUpdate(changes){ // can't get active streams update here ;_;
	console.log("TYPED STORAGE", changes)
	for(const [key, val] of Object.entries(changes)){
		//console.log(key, val, changes, Object.entries(changes))
		switch(key){
			case UPDATE_INTERVAL_KEY:
				console.log("SETTINGS UPDATE", UPDATE_INTERVAL_KEY)
				await TryEnableAlarm()
		}
	}
}

/* *********************************************************************************************************** */

/**
 * 
 */
function IsOnline(){
	return navigator.onLine && Browser.isActiveState()
}

async function GetSettingsInstance(){
	return Settings.Create(undefined, undefined, [ACTIVE_STREAMS_KEY, LAST_UPDATE_KEY])
}

/**
 * @param {number} date 
 */
async function IsStreamsExpired(date){
	SETTINGS ??= await GetSettingsInstance()
	const timestamp = await SETTINGS.Get(LAST_UPDATE_KEY)
	console.log(timestamp, await SETTINGS.Get(UPDATE_INTERVAL_KEY), date, timestamp + (await SETTINGS.Get(UPDATE_INTERVAL_KEY)) - date)
	return timestamp == null || timestamp + (await SETTINGS.Get(UPDATE_INTERVAL_KEY)) - date < 0
}

async function TryEnableAlarm(checkFireOnWake=false){
	try{
		SETTINGS ??= await GetSettingsInstance()
		await SetUpdateAlarm(checkFireOnWake ? await SETTINGS.Get(FIRE_ON_WAKE) : undefined)
	}catch(e){
		console.warn(e)
	}
}

async function TryDisableAlarm(){
	try{
		await ClearUpdateAlarm()
	}catch(e){
		console.warn(e)
	}
}

/**
 * This method will update the 'update' alarm, taking into account:
 *  * The last update timestamp
 *  * The update interval
 * 
 * If there are no clientIDs the alarm is disabled
 * 
 * This will imediately fire if:
 *  * There is no last update timestamp
 *  * the last update + update interval is expired ( <= Date.now())
 * 
 * Otherwise this will fire when Date.now() === last update timestamp + update interval
 */
async function SetUpdateAlarm(fireImediately=false, tolerance=30000){
	console.log("Setting Update Alarm, fireImediately:", fireImediately)
	ACCOUNTS_CONTROLLER ??= await StreamClientController.Create()

	// if we don't have any streams to watch, don't bother updating
	if((await ACCOUNTS_CONTROLLER.GetClientIDs()).length === 0)
		return ClearUpdateAlarm()

	const alarm = await Browser.Alarms.get(UPDATE_STREAMS_ID)
	console.log(alarm)
	
	SETTINGS ??= await GetSettingsInstance()
	const updateInterval = await SETTINGS.Get(UPDATE_INTERVAL_KEY)

	let GetDelay = async ()=>{
		let updateTime = await SETTINGS.Get(LAST_UPDATE_KEY)
		console.log(updateTime, updateInterval, Date.now(), updateTime + updateInterval - Date.now())
		if(updateTime != null){
			updateTime += (updateInterval - Date.now()) // time in millis before next update
			console.log(updateTime)
			if(updateTime > 0)
				return updateTime
		}
		return false
	}

	const delay = fireImediately ? false : await GetDelay()
	console.log("Delay", delay)
	await _CreateAlarm(UPDATE_STREAMS_ID, updateInterval, delay)
}


/**
 * @param {string} id 
 * @param {number} period if present, alarm will fire every [period]
 * @param {number|boolean} delay if false will fire imediately. if a number will fire after that many milliseconds. if true or default will use the period as initial delay
 */
async function _CreateAlarm(id, period=undefined, delay=true){
	let opts = {}
	if(period != null)
		opts["periodInMinutes"] = period / 60000
	if(typeof delay === 'number')
		opts["delayInMinutes"] = delay / 60000

	console.log("Creating Alarm:", id, opts, delay)

	if(await Browser.Alarms.get(id) != null)
		await Browser.Alarms.clear(id)
	
	Browser.Alarms.create(id, opts)

	if(delay === false){
		const alarm = await Browser.Alarms.get(UPDATE_STREAMS_ID)
		console.log(alarm)
		OnAlarm(alarm)
	}
}

function ClearUpdateAlarm(){
	console.log("Stopping alarm", UPDATE_STREAMS_ID)
	return Browser.Alarms.clear(UPDATE_STREAMS_ID)
}

async function UpdateCurrentStreamers(){
	console.log("Starting lock behaviour")
	const now = Date.now()
	if(await IsStreamsExpired(now)){
		ACCOUNTS_CONTROLLER ??= await StreamClientController.create()
		await ACCOUNTS_CONTROLLER.FetchStreams()
		SETTINGS ??= await GetSettingsInstance()

		await SETTINGS.Set(LAST_UPDATE_KEY, now)
	}else{
		console.log("Existing cache is not expired")
	}
	console.log("Done Lock Behaviour")
}


async function UpdateBadge(){
	console.log("Updating Badge")
	ACCOUNTS_CONTROLLER ??= await StreamClientController.Create()
	SETTINGS ??= await GetSettingsInstance()

	const streamCache = await ACCOUNTS_CONTROLLER.GetCachedStreams(undefined, await SETTINGS.Get(MERGE_SAME_NAME))
	const cacheLength = streamCache.length
	console.log(streamCache)
	
	const accountErrsCount = (await ACCOUNTS_CONTROLLER.GetErrors()).length

	// TODO: BECAUSE i18n IS BROKEN IN SERVICE WORKER: https://bugs.chromium.org/p/chromium/issues/detail?id=1268098
	//const title = await GetI18nText("pl_currentStreaming", [activeStreamsCount, accountErrsCount])
	let title = [`${cacheLength} Pe${cacheLength === 1 ? "rson" : "ople"} Streaming`]
	if(accountErrsCount > 0)
		title.push(`${accountErrsCount} Account Error${accountErrsCount > 1 ? "s" : ""}`)
	title = title.join('\n')

	console.log(title, cacheLength, accountErrsCount, streamCache)
	Browser.SetBadgeTitle(title)
	if(accountErrsCount > 0){
		cacheLength += '⚠' // don't acc account errors number to save space
		Browser.SetBadgeColor("#FFAE42")
	}else{
		Browser.SetBadgeColor("#1E2F97")
	}
	Browser.SetBadgeText(cacheLength > 0 ? cacheLength : "")
}