import { OAuth2PKCEAuth } from "../authTypes/OAuth2PKCEAuth.js"
import { Provider } from "../provider.js"
import { WebRequest } from "../webRequest.js"

export class Twitch extends Provider(OAuth2PKCEAuth){    
	Payload(auth){
		return {headers:{"authorization":`${"Bearer"} ${auth["access_token"]}`, "client-id":this.ClientID}} // twitch returns lowercase 'bearer' but expects uppercase :/
	}
	async Authenticate(manuallyTriggered=false, request={}){
		if(manuallyTriggered)
			request["force_verify"] = true
		return super.Authenticate(manuallyTriggered, request)
	}
	async GetUIDAndName(auth){
		var userData = (await WebRequest.GET("https://api.twitch.tv/helix/users", this.Payload(auth)))["data"][0]
		return [userData["id"], userData["display_name"]] // or "login"
	}
	async FetchStreams(auth, UID){
		const opts = this.Payload(auth)
		const streams = (await WebRequest.GET("https://api.twitch.tv/helix/streams/followed?user_id="+UID, opts))["data"]

		// TODO: the maximum I can ask for is 100 per call
		const result = (await WebRequest.GET("https://api.twitch.tv/helix/users?"+streams.map(s=>"id="+s["user_id"]).join('&'), opts))["data"]
		const imgDict = Object.fromEntries(result.map(d=>[d["id"], d["profile_image_url"]]))

		return streams.map(s=>[
			s["user_name"],
			"https://twitch.tv/"+s["user_name"], 
			imgDict[s["user_id"]],
			s["title"].trim()
		])
	}
}