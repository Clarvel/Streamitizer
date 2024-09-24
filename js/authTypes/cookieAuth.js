import { Browser } from "../browser.js"
import { Authentication } from "../authentication.js"

export class CookieAuth extends Authentication{
	constructor({"CookieDomain":CookieDomain, "CookieName":CookieName}){
		super(arguments)
		this._CookieDomain = CookieDomain
		this._CookieName = CookieName
	}

	async Authenticate(manuallyTriggered=false){
		let cookie = await Browser.GetCookie(this._CookieDomain, this._CookieName)
		if(cookie == null)
			throw Error(`Could not find cookie at ${this._CookieDomain} with name ${this._CookieName}`)
		const response = JSON.parse(decodeURIComponent(cookie))
		//console.log(response)
		return response
	}
}