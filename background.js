import { Browser } from "./js/browser.js"
import { CACHE_KEY, CONSOLIDATE, ERRS_KEY, LAST_UPDATE_KEY, MULTIPLE_NOTIFS_ID, NOTIFICATIONS, HIDEZERO, UPDATE_INTERVAL_KEY, UPDATE_STREAMS_ID } from "./js/IDs.js"
import { MetadataSettings } from "./js/settings.js"
import { StreamsService, FlatClientsData } from "./js/streamsService.js"
import { GetI18nText } from "./js/utils.js"

const SETTINGS = new MetadataSettings("../options.json")

async function OnStorageChanged(updates){
	console.debug(updates)
	for (const [k, v] of updates) {
		switch(k){
			case UPDATE_INTERVAL_KEY:
				console.log(k, v)
				UpdateAlarm(v)
				break
			case ERRS_KEY:
				UpdateBadge(null, v)
			default:
				//console.warn("UNKNOWN STORAGE CHANGE", updates)
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
		//console.log(updateInterval, lastUpdate)
	}
	const countdown = updateInterval + (lastUpdate ?? Number.NEGATIVE_INFINITY) - Date.now()
	//console.debug(updateInterval, lastUpdate, countdown)
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

	let title = [await GetI18nText(streamCount === 1 ? "currentStream" : "currentStreams", [streamCount])]
	if(streamCount == 0 && (await SETTINGS.GetSingle(HIDEZERO))) streamCount = ""
	if(errsCount > 0){
		streamCount += "⚠" // don't acc account errors number to save space
		title.push(await GetI18nText(errsCount === 1 ? "currentError" : "currentErrors", [errsCount]))
	}
	Browser.SetBadgeColor(errsCount > 0 ? "#FFAE42" : "#1E2F97")
	Browser.SetBadgeTitle(title.join('\n'))
	Browser.SetBadgeText(streamCount)
}

async function UpdateCurrentStreamers(){
	console.log("Starting lock behaviour")
	const now = Date.now()
	const [updateInterval, lastUpdate] = await SETTINGS.Get([UPDATE_INTERVAL_KEY, LAST_UPDATE_KEY])
	if(lastUpdate == null || now > lastUpdate + updateInterval){
		await StreamsService.FetchStreams()
		await SETTINGS.Set(LAST_UPDATE_KEY, now)
	}else{
		console.log("Existing cache is not expired")
	}
	console.log("Done Lock Behaviour")
}

// This is ONLY for the notifications check & updating the badge atm, since I need to see old & new
async function OnStorageStateChanged(changes){
	for(const [k, v] of Object.entries(changes)){
		switch(k){
			case CACHE_KEY:
				UpdateBadge(v["newValue"], null)
				if(await SETTINGS.GetSingle(NOTIFICATIONS)){
					// want to find all NEW entries, so all n not in o
					const existing = FlatClientsData(v["oldValue"]).map(([name, link, icon, desc]) => name)
					const newEntries = FlatClientsData(v["newValue"]).filter(([name, link, icon, desc]) => !existing.includes(name))
					if(newEntries > 1 && await SETTINGS.GetSingle(CONSOLIDATE))
						Browser.CreateNotification(MULTIPLE_NOTIFS_ID, "Multiple new Streams!", "")
					else
						newEntries.forEach(([name, link, icon, desc]) => Browser.CreateNotification(link, name, desc, icon))
				}
		}
	}
}

function RuntimeSetup(){
	UpdateAlarm() // ensure alarm exists
	UpdateBadge()
}

// alarms/event handlers MUST be set here, not encapsulated by anything
SETTINGS.OnUpdate(OnStorageChanged)
Browser.OnStorageStateChanged(OnStorageStateChanged)
Browser.OnAlarm(OnAlarm)
Browser.OnNotificationClicked((id) => id === MULTIPLE_NOTIFS_ID ? Browser.OpenPopup() : Browser.OpenInNewTab(id))
Browser.OnInstalled(RuntimeSetup)
RuntimeSetup()