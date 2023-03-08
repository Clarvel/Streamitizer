import { OAuth2PKCEAuth } from "../AuthenticationClients/OAuth2PKCEAuth.js"
import { GenericStreamClient } from "./GenericStreamClient.js"
import { ConsolidatePaginated, EncodeDataURL, PromiseAll } from "../utils.js"
import { WebRequest } from "../webRequest.js"
import { FormatString, GetValueFromNestedObject } from "../utils.js"

const ACCOUNT_API_KEY = "AccountAPI"
const FOLLOWS_API_KEY = "FollowingAPI"
const SUBSCRIPTIONS_API_KEY = "SubscriptionsAPI"
const STREAMS_URL_KEY = "WatchURL"

export class Picarto extends GenericStreamClient{
	static AuthClientType = OAuth2PKCEAuth
	static Type = "picarto"

	static _Opts(auth){
		return {headers:{"authorization":`${auth["token_type"]} ${auth["access_token"]}`}}
	}

	async _GetUsername(authentication){
		return (await WebRequest.GET(await this._Settings.Get(ACCOUNT_API_KEY), Picarto._Opts(authentication)))["channel_details"]["name"]
	}

	async _GetActiveStreams(authentication){
		const opts = Picarto._Opts(authentication)
		const streamUrl = await this._Settings.Get(STREAMS_URL_KEY)

		const followed = (await PromiseAll([FOLLOWS_API_KEY, SUBSCRIPTIONS_API_KEY].map(async key=>{
			const api = await this._Settings.Get(key)
			return ConsolidatePaginated(pageNum=>WebRequest.GET((EncodeDataURL(api, {"page":pageNum, "priority_online":true})), opts), data=>!data["online"], 1) 
		}), true)).flat().map(s=>s["user_id"])

		const streams = (await WebRequest.GET("https://api.picarto.tv/api/v1/online?adult=true&gaming=true", opts)).filter(s=>s["following"] || followed.indexOf(s["user_id"]) > -1).map(s=>[
			s["name"],
			FormatString(streamUrl, [s["name"]]),
			s["avatar"],
			s["title"]
		])

		return streams
	}
}