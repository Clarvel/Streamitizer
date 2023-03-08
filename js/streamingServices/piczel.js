import { CookieAuth } from "../AuthenticationClients/CookieAuth.js";
import { FormatString, GetValueFromNestedObject } from "../utils.js"
import { WebRequest } from "../webRequest.js"
import { GenericStreamClient, StreamInfo, TypedStreamData } from "./GenericStreamClient.js";
import { EncodeDataURL } from "../utils.js";

const ACCOUNT_API_KEY = "AccountAPI"
const ACCOUNT_NAME_PATH_KEY = "AccountNamePath"
const STREAMS_API_KEY = "StreamsAPI"
const STREAMS_URL_KEY = "WatchURL"

export class Piczel extends GenericStreamClient{
	static AuthClientType = CookieAuth
	static Type = "piczel"

	async _GetUsername(authentication){return (await WebRequest.GET(await this._Settings.Get(ACCOUNT_API_KEY), {headers:authentication}))["username"]}

	async _GetActiveStreams(authentication){
		const url = EncodeDataURL(await this._Settings.Get(STREAMS_API_KEY), {
			"followedStreams":true,
			"live_only":true,
			"sfw":!await this._Settings.Get("showNSFW")
		})
		const streamUrl = await this._Settings.Get(STREAMS_URL_KEY)
		return (await WebRequest.GET(url, {headers:authentication})).filter(s=>s["live"] === true && s["following"]?.["value"] === true).map(s=>[
			s["username"],
			FormatString(streamUrl, [s["username"]]), 
			s["user"]?.["avatar"]?.["url"],
			s["title"] ?? s["description"]
		])
	}
}