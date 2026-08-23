import { PersonalTokenAuth } from "../authTypes/personalTokenAuth.js"
import { ParseFetchError } from "../errors.js"
import { Provider } from "../provider.js"
import { WebRequest } from "../webRequest.js"

export class Piczel extends Provider(PersonalTokenAuth){
	Payload(auth){
		return {headers:{"Authorization":`Bearer ${auth}`}}
	}

	async GetUIDAndName(auth){
		const username = (await WebRequest.GET("https://piczel.tv/api/users/me", this.Payload(auth)))["username"]
		return [username, username]
	}

	async FetchStreams(auth, UID){
		const json = (await WebRequest.GET("https://piczel.tv/api/feed?hideNsfw=false", this.Payload(auth)))
		if(!Array.isArray(json))
			throw ParseFetchError("Piczel Fetch could not find Stream Data")
		return json.filter(s=>s["action"] === "live").map(s=>[
			s["user"]["username"],
			"https://piczel.tv/watch/"+s["user"]["username"], 
			s["user"]["avatar"]["url"],
			(s["thing"]["title"] ?? s["thing"]["description"]).trim()
		])
		
		// TODO: this doesn't work with live_only=true ;_;
		/*return (await WebRequest.GET("https://piczel.tv/api/streams?followedStreams=true&live_only=false&sfw=false", {"headers":auth})).filter(s=>s["live"] === true && s["following"]?.["value"] === true).map(s=>[
			s["username"],
			"https://piczel.tv/watch/"+s["username"], 
			s["user"]?.["avatar"]?.["url"],
			(s["title"] ?? s["description"]).trim()
		])*/
	}
}