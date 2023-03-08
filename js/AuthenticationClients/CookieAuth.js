import { GenericAuthClient as GenericAuthClient } from "./GenericAuthClient.js"
import { Browser } from "../browser.js"

/*class CookieResponse{

	constructor({"access-token":access_token, "client":client, "uid":uid}){
		this.AccessToken = access_token
		this.Client = client
		this.UID = uid
	}
	ToObject(){return {"access-token":this.AccessToken, "client":this.Client, "uid":this.UID}}
}*/

export class CookieAuth extends GenericAuthClient{
	static Type = "cookieAuth"
	constructor({"CookieDomain":CookieDomain, "CookieName":CookieName}){
		super()
		this._CookieDomain = CookieDomain
		this._CookieName = CookieName
	}

	async Authenticate(manuallyTriggered=false){
		let cookie = await Browser.GetCookie(this._CookieDomain, this._CookieName)
		if(cookie == null)
			throw Error(`Could not find cookie at ${this._CookieDomain} with name ${this._CookieName}`)
		const response = JSON.parse(decodeURIComponent(cookie))
		//console.log(response)
		return response // new CookieResponse(JSON.parse(decodeURIComponent(cookie)))
	}

	async Refresh(token){return this.Authenticate(false)}
}
