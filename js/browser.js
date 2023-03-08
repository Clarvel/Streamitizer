import {ObjFilter, PromiseAll, PromiseCB, TrimChars} from "./utils.js"

var browser = chrome

let _lastActiveState = "active"


export class Browser{
	static ApplyTheme(theme){
		if(theme === "Dark" || theme === "System" && window.matchMedia('(prefers-color-scheme: dark)').matches)
			document.documentElement.setAttribute("data-bs-theme", "dark")
	}

	/**
	 * @param {string} url
	 */
	static OpenInNewTab(url){return window.open(url, '_blank')}

	/**
	 * @param {object} data
	 * @returns {Promise<object>} response
	 */
	static SendMessage(data){
		console.log(data)
		return PromiseCB(browser.runtime.sendMessage, data).catch((err)=>{
			console.warn(err, data)
			if(err.message !== "Could not establish connection. Receiving end does not exist.")
				throw Error(err["message"])
		})
	}

	/**
	 * @callback MessageHandler
	 * @param {object} response
	 * @returns {*} reply
	 */

	/**
	 * @param {MessageHandler} func 
	 * @returns {number} listener index number
	 */
	static OnMessage(func){
		return browser.runtime.onMessage.addListener((response, sender, sendResponse)=>{
			try{
				sendResponse(func(response))// TODO handle with Promise instead of sendResponse, once chrome enables it
				return true
			}catch(e){
				console.warn(e)
			}
			return false
		})
	}

	/**
	 * @callback ActiveStateChangedHandler
	 * @param {boolean} isActive 
	 */

	/**
	 * @param {ActiveStateChangedHandler} func
	 * @returns {number} listener index number
	 */
	static OnActiveStateChanged(func){
		return browser.idle.onStateChanged.addListener((state)=>{ // possible states are ["locked", "idle", "active"]
			if(state !== "idle" && state !== _lastActiveState){ // don't care about "idle" state
				_lastActiveState = state
				return func(this.isActiveState()) // func input will be true for "active", false for anything else ("locked")
			}
		})
	}

	static isActiveState(){
		return _lastActiveState === "active"
	}

	/**
	 * @param {Array<string>|string} keys 
	 * @returns {Promise<Object.<string, *>}
	 */
	static GetStorage(keys, sync=true){
		const location = sync ? browser.storage.sync : browser.storage.local
		return PromiseCB(location.get.bind(location), keys)
	}

	/**
	 * @param {object} data 
	 * @returns {Promise}
	 */
	static SetStorage(data, sync=true){
		const location = sync ? browser.storage.sync : browser.storage.local
		return location.set(data)}

	/**
	 * @param {Array<string>|string} keys 
	 * @returns {Promise}
	 */
	static RemoveStorage(keys, sync=true){
		const location = sync ? browser.storage.sync : browser.storage.local
		return PromiseCB(location.remove.bind(location), keys)
	}

	/**
	 * @returns {Promise}
	 */
	static ClearStorage(sync=true){
		console.log("DELETING ALL STORAGE...");
		const location = sync ? browser.storage.sync : browser.storage.local
		return PromiseCB(location.clear.bind(location))}


	static OnStorageStateChanged(func){
		return browser.storage.onChanged.addListener((changes, namespace)=>{
			return func(changes)
		})
	}


	/*chrome.storage.onChanged.addListener(function (changes, namespace) {
	for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
		console.log(
		`Storage key "${key}" in namespace "${namespace}" changed.`,
		`Old value was "${oldValue}", new value is "${newValue}".`
		);
	}
	});*/


	/**
	 * @callback NotificationClickedHandler
	 * @param {string} notificationId 
	 */

	/**
	 * @param {NotificationClickedHandler} func
	 * @returns {number} listener index number
	 */
	static OnNotificationClicked(func){return browser.notifications.onClicked.addListener(func)}

	/**
	 * @param {string} notificationId 
	 * @returns {Promise} 
	 */
	static ClearNotification(notificationId){
		return browser.notifications.clear(notificationId).then(response=>{if(!response) throw new Error(`Failed to clear notification ${notificationId}`)})
	}

	/**
	 * @param {string} id if empty, will be generated
	 * @param {string} title 
	 * @param {string} message 
	 * @param {string} iconUrl 
	 * @param {Array<{action:string, title:string, icon:string}>} actions
	 * @returns {Promise<string>} response will be the notification id
	 */
	static CreateNotification(id, title, message, iconUrl="", actions=undefined){
		try{
			return browser.notifications.create(id, {
				"type":"basic",
				"iconUrl":iconUrl,
				"title":title,
				"message":message,
				"actions":actions
			})
		}catch(e){
			console.warn(e)
		}
	}

	/**
	 * @param {string} encodedURL 
	 * @param {boolean} interactive 
	 * @returns {Promise<string>} redirect uri
	 */
	static async LaunchWebAuthFlow(encodedURL, interactive){
		let data = {
			"url":encodedURL,
			"interactive":interactive
		}
		console.log(data)
		var result = await browser.identity.launchWebAuthFlow(data)
		console.log(result)
		return result
		//return PromiseCB(browser.identity.launchWebAuthFlow.bind(browser.identity), data)
	}

	/**
	 * @callback BadgeClickedHandler
	 * @param {object} tab tab that was active when badge was clicked
	 */

	/**
	 * @param {BadgeClickedHandler} func
	 * @returns {number} listener index number
	 */
	static OnBadgeClicked(func){return browser.action.onClicked.addListener(func)}

	/**
	 * @returns {Promise<string>} fully qualified url to the popup
	 */
	static GetPopup(){return PromiseCB(browser.action.getPopup, {})}

	/**
	 * setting url to empty string disables the popup page
	 * @param {string} url fully qualified url or empty string
	 */
	static SetPopup(url){browser.action.setPopup({"popup":url})}

	/**
	 * @param {string} text 
	 */
	static SetBadgeText(text){browser.action.setBadgeText({"text":text.toString()})}

	/**
	 * @param {string} text 
	 */
	static SetBadgeTitle(text){browser.action.setTitle({"title":text.toString()})}

	/**
	 * @param {string|[number, number, number, number]} color
	 */
	static SetBadgeColor(color){browser.action.setBadgeBackgroundColor({"color":color})}

	/**
	 * @returns {Promise}
	 */
	static OpenOptionsPage(){return browser.runtime.openOptionsPage()}

	/**
	 * @typedef {object} InstalledResponse
	 * @property {string} id
	 * @property {string} previousVersion
	 * @property {boolean} temporary
	 * @property {string} reason one of ["install", "update", "browser_update", "shared_module_update"]
	 */

	static OnInstalled(func){
		browser.runtime.onInstalled.addListener(func)
		/*return new Promise((resolve, reject)=>{
			browser.runtime.onInstalled.addListener(resolve)
		})*/
	}

	static OnStartup(func){
		browser.runtime.onStartup.addListener(func)
	}
	
	// https://cmnfbkpodnopafgnlicpjjnpcgdlclde.chromiumapp.org
	static ExtensionRedirectURI(){return TrimChars(browser.identity.getRedirectURL(), "/")}

	/**
	 * 
	 * @param {string} key 
	 * @param {Array<string>} replacements 
	 * @returns {string}
	 */
	static GetLocaleText(key, replacements = undefined){
		let text = browser.i18n.getMessage(key, replacements)
		console.log(key, replacements, text)
		if(text == null || text == '')
			throw new Error(`Null text for key '${key}'`)

		return text
	}

	/**
	 * 
	 * @param {string} domain 
	 * @param {string} name 
	 */
	static async GetCookie(domain, name){
		// const permissions = {"permissions": ['cookies'], "origins": [domain]}
		// if(!await chrome.permissions.contains(permissions) && !await browser.permissions.request(permissions))
		// 	throw Error(`Cookie Permissions were denied for ${domain}`)

		let cookie = await browser.cookies.get({"url":domain, "name":name})
		if(cookie){ // null check
			// if the cookie has expired, don't use it
			if(cookie.expirationDate && cookie.expirationDate < Math.floor(Date.now() / 1000)){
				console.warn(`${name} cookie for ${domain} has expired. Please login to ${domain} again to refresh the cookie.`)
				return null
			}
			return cookie.value
		}
		return null
	}
	
	/**
	 * @returns {String}
	 */
	static UUID(){return window.crypto.randomUUID()}

	/**
	 * 
	 * @param {string} name 
	 * @param {Function} lockedFunc
	 * @returns {Promise} 
	 */
	static Lock(name, lockedFunc){return navigator.locks.request(name, lockedFunc)}

	/**
	 * @returns {Alarms}
	 */
	static get Alarms(){return browser.alarms}
}