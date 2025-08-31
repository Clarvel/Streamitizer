var browser = chrome

export class Browser{
	// absolute garbage
	static InvokeStartFunc = func => chrome ? func() : window.onload = func

	static ApplyTheme(theme){
		if(theme === "system")
			theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : ""
		document.documentElement.setAttribute("data-bs-theme", theme)
	}

	static OpenInNewTab = url => browser.tabs.create({"url":url})
	static OpenPopup = (metadata) => this.OpenInNewTab(`html/popup.html${metadata}`)//chrome ? browser.action.openPopup() : browser.browserAction.openPopup()

	/**
	 * @param {object} data
	 * @returns {Promise<object>} response
	 */
	static SendMessage(data){
		console.log(data)
		return browser.runtime.sendMessage(data).catch(err => {
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
		return browser.runtime.onMessage.addListener((response, sender, sendResponse) => {
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
	 * @param {Array<string>|string} keys 
	 * @returns {Promise<Object.<string, *>}
	 */
	static GetStorage = (keys, sync=true) => (sync ? browser.storage.sync : browser.storage.local).get(keys)
	static SetStorage = (data, sync=true) => (sync ? browser.storage.sync : browser.storage.local).set(data)
	static RemoveStorage = (keys, sync=true) => {console.log(keys);(sync ? browser.storage.sync : browser.storage.local).remove(keys)}
	static ClearStorage(sync=true){
		console.warn("DELETING ALL STORAGE...")
		return (sync ? browser.storage.sync : browser.storage.local).clear()
	}
	static OnStorageStateChanged = func => browser.storage.onChanged.addListener(func)

	static OnNotificationClicked = func => browser.notifications.onClicked.addListener(func)
	static ClearNotification = id => browser.notifications.clear(id).then(response => {
		if(!response)
			throw new Error(`Failed to clear notification ${notificationId}`
	)})

	/**
	 * @param {string} id if empty, will be generated
	 * @param {string} title 
	 * @param {string} message 
	 * @param {string} iconUrl 
	 * @returns {Promise<string>} response will be the notification id
	 */
	static CreateNotification = (id, title, message, iconUrl=undefined) => browser.notifications.create(id, {
		"type":"basic",
		"iconUrl":iconUrl ?? browser.runtime.getURL('icons/icon.png'),
		"title":title,
		"message":message
	}).catch(console.warn)

	static OnInstalled = func => browser.runtime.onInstalled.addListener(func)
	static OnStartup = func => browser.runtime.onStartup.addListener(func)

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

	static SetBadgeText(text){browser.action.setBadgeText({"text":text.toString()})}
	static SetBadgeTitle(text){browser.action.setTitle({"title":text.toString()})}
	static SetBadgeColor(color){browser.action.setBadgeBackgroundColor({"color":color})}
	static OpenOptionsPage(){return browser.runtime.openOptionsPage()}

	// https://cmnfbkpodnopafgnlicpjjnpcgdlclde.chromiumapp.org/
	static ExtensionRedirectURI = browser.identity.getRedirectURL

	/**
	 * 
	 * @param {string} key 
	 * @param {Array<string>} replacements 
	 * @returns {string}
	 */
	static GetLocaleText(key, replacements = undefined){
		let text = browser.i18n.getMessage(key, replacements)
		//console.log(key, replacements, text)
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
		if(cookie != null){
			// if the cookie has expired, don't use it
			if(cookie.expirationDate != null && cookie.expirationDate < Math.floor(Date.now() / 1000)){
				console.warn(`${name} cookie for ${domain} has expired. Please login to ${domain} again to refresh the cookie.`)
				return null
			}
			return cookie.value
		}
		return null
	}
	
	static UUID(){return window.crypto.randomUUID()}

	static Lock(name, func){return navigator.locks.request(name, func)}

	static GetAlarm(name){return browser.alarms.get(name)}
	static CreateAlarm(name, opts){return browser.alarms.create(name, opts)}
	static OnAlarm(func){return browser.alarms.onAlarm.addListener(func)}

}
