import { NoAuth } from "../authTypes/noAuth.js"
import { ParseFetchError } from "../errors.js"
import { Provider } from "../provider.js"
import { WebRequest } from "../webRequest.js"

export class Piczel extends Provider(NoAuth){
	async GetUIDAndName(auth){
		const data = (await WebRequest.GET("https://api.piczel.tv/users/me"))
		return [data["id"], data["username"]]
	}

	async FetchStreams(auth, UID){
		const json = (await WebRequest.GET("https://api.piczel.tv/feed?hideNsfw=false"))
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