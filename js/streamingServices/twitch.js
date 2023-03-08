import { OAuth2PKCEAuth } from "../AuthenticationClients/OAuth2PKCEAuth.js"
import { GenericStreamClient } from "./GenericStreamClient.js"
import { ConsolidatePaginated, EncodeDataURL, PromiseAll } from "../utils.js"
import { WebRequest } from "../webRequest.js"
import { FormatString, GetValueFromNestedObject } from "../utils.js"

const ACCOUNT_API_KEY = "AccountAPI"
const STREAMS_API_KEY = "StreamsAPI"
const STREAMS_URL_KEY = "WatchURL"

export class Twitch extends GenericStreamClient{
	static AuthClientType = OAuth2PKCEAuth
	static Type = "twitch"

	static _Opts(auth){
		return {headers:{"authorization":`Bearer ${auth["access_token"]}`, "client-id":"eq1wpnbv4jmkq48g9v1bsepfvoh4ou"}}
	}

	async _GetUsername(authentication){
		return (await WebRequest.GET(await this._Settings.Get(ACCOUNT_API_KEY), Twitch._Opts(authentication)))["data"][0]["display_name"] // or "login"
	}

	async _GetActiveStreams(authentication){
		const opts = Twitch._Opts(authentication)
		const api = await this._Settings.Get(STREAMS_API_KEY)
		const streams = (await WebRequest.GET(api, opts))["data"]

		// TODO: the maximum I can ask for is 100 per call
		const result = (await WebRequest.GET((await this._Settings.Get(ACCOUNT_API_KEY)) + "?" + streams.map(s=>`id=${s["user_id"]}`).join('&'), opts))["data"]
		const imgDict = Object.fromEntries(result.map(d=>[d["id"], d["profile_image_url"]]))

		console.log(streams)
		const streamUrl = await this._Settings.Get(STREAMS_URL_KEY)
		return streams.map(s=>[
			s["user_name"],
			FormatString(streamUrl, [s["user_name"]]), 
			imgDict[s["user_id"]],
			s["title"]
		])
	}
}