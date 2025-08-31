import { Browser } from "./js/browser.js"
import { CACHE_KEY, GROUP_NOTIFICATIONS, ERRS_KEY, LAST_UPDATE_KEY, MULTIPLE_NOTIFS_ID, NOTIFICATIONS, HIDEZERO, UPDATE_INTERVAL_KEY, UPDATE_STREAMS_ID } from "./js/IDs.js"
import { MetadataSettings } from "./js/settings.js"
import { StreamsService, FlatClientsData } from "./js/streamsService.js"
import { GetI18nText } from "./js/utils.js"

const SETTINGS = new MetadataSettings("../options.json")

async function OnStorageChanged(updates){
	for (const [k, v] of updates) {
		switch(k){
			case UPDATE_INTERVAL_KEY: // this update should come from options page saving
				UpdateAlarm(v)
				break
			case ERRS_KEY:
				UpdateBadge(null, v)
				break
			default: // no default on unknown storage keys
		}
	}
}

async function OnAlarm(alarm){
	switch(alarm.name){
		case UPDATE_STREAMS_ID:
			return Browser.Lock(UPDATE_STREAMS_ID, UpdateCurrentStreamers)
		default:
			console.warn("UNKNOWN ALARM:" + alarm)
	}
}

async function UpdateAlarm(updateInterval=null){
	let lastUpdate = null
	if(updateInterval == null || await Browser.GetAlarm(UPDATE_STREAMS_ID) == null){
		console.debug("Alarm not found. creating...")
		;[updateInterval, lastUpdate] = await SETTINGS.Get([UPDATE_INTERVAL_KEY, LAST_UPDATE_KEY]) // yes the semicolon is required here
	}
	const countdown = updateInterval + (lastUpdate ?? Number.NEGATIVE_INFINITY) - Date.now()
	let opts = {
		"periodInMinutes": updateInterval / 60000,
		"delayInMinutes" : countdown > 0 ? countdown / 60000 : 0.5 // 0.5 is the minimum I can set it to
	}
	console.debug("Creating Alarm:", opts)
	Browser.CreateAlarm(UPDATE_STREAMS_ID, opts) // clears itself
}

async function UpdateBadge(streams=null, errs=null){
	let streamCount = await StreamsService.StreamsCount(streams)
	const errsCount = await StreamsService.ErrsCount(errs)

	let title = [GetI18nText(streamCount === 1 ? "currentStream" : "currentStreams", [streamCount])]
	if(streamCount == 0 && (await SETTINGS.GetSingle(HIDEZERO))) streamCount = ""
	if(errsCount > 0){
		streamCount += "⚠" // don't acc account errors number to save space
		title.push(GetI18nText(errsCount === 1 ? "currentError" : "currentErrors", [errsCount]))
	}
	Browser.SetBadgeColor(errsCount > 0 ? "#FFAE42" : "#1E2F97")
	Browser.SetBadgeTitle(title.join('\n'))
	Browser.SetBadgeText(streamCount)
}

async function UpdateCurrentStreamers(){
	console.log("Starting lock behaviour")
	const now = Date.now()
	const [updateInterval, lastUpdate] = await SETTINGS.Get([UPDATE_INTERVAL_KEY, LAST_UPDATE_KEY])
	if(lastUpdate == null || now >= lastUpdate + updateInterval){
		await SETTINGS.Set({[CACHE_KEY]:(await StreamsService.FetchStreams()), [LAST_UPDATE_KEY]:now})
	}else{
		console.log("Existing cache is not expired")
	}
	console.log("Done Lock Behaviour")
}

// This is ONLY for the notifications check & updating the badge atm, since I need to see old & new
async function OnStorageStateChanged(changes){
	const cache = changes[CACHE_KEY]
	if(!cache) return // if changes doesn't have the 1 change I'm looking for, return
	UpdateBadge(cache["newValue"], null)
	const [notifications, updateInterval] = await SETTINGS.Get([NOTIFICATIONS, UPDATE_INTERVAL_KEY])

	if(!notifications || (changes[LAST_UPDATE_KEY]?.["newValue"] ?? Number.MAX_VALUE) + updateInterval/4 < Date.now()) return // if notifications are off or the incoming changes are old, don't notify. if LAST_UPDATE_KEY doesn't exist, assume values are current
	// want to find all NEW entries, so all n not in o
	const existing = new Set(FlatClientsData(cache["oldValue"]).map(([name, link, icon, desc]) => name))
	const newEntries = [...new Map(FlatClientsData(cache["newValue"]).filter(([name, link, icon, desc]) => !existing.has(name)).map(stream => [stream[0], stream])).values()]

	const groupNotif = await SETTINGS.GetSingle(GROUP_NOTIFICATIONS)
	if(newEntries.length > groupNotif && groupNotif > 0)
		Browser.CreateNotification(MULTIPLE_NOTIFS_ID, GetI18nText("notificationsTitle"), GetI18nText("notificationsDesc"))
	else
		newEntries.forEach(([name, link, icon, desc]) => Browser.CreateNotification(link, name, desc, icon))
}

// alarms/event handlers MUST be set here, not encapsulated by anything
SETTINGS.OnUpdate(OnStorageChanged)
Browser.OnStorageStateChanged(OnStorageStateChanged)
Browser.OnAlarm(OnAlarm)
Browser.OnNotificationClicked((id) => {
	try{
		return id === MULTIPLE_NOTIFS_ID ? Browser.OpenPopup(MULTIPLE_NOTIFS_ID) : Browser.OpenInNewTab(id)
	}catch(e){
		console.warn(e)
	}
})

const RuntimeSetup = () => Promise.all([UpdateAlarm(), UpdateBadge()])
RuntimeSetup().then(() => {
	Browser.OnInstalled(RuntimeSetup)
	Browser.OnStartup(RuntimeSetup)
})
