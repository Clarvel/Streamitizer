import { CookieAuth } from "../authTypes/cookieAuth.js"
import { Provider } from "../provider.js"
import { WebRequest } from "../webRequest.js"

export class Piczel extends Provider(CookieAuth){
	async GetUIDAndName(auth){
		const username = (await WebRequest.GET("https://piczel.tv/api/users/me", {"headers":auth}))["username"]
		return [username, username]
	}

	async FetchStreams(auth, UID){
		return (await WebRequest.GET("https://piczel.tv/api/feed?hideNsfw=false", {"headers":auth})).filter(s=>s["action"] === "live").map(s=>[
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