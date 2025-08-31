import { Provider } from "../provider.js"
import { WebRequest } from "../webRequest.js"
import { ConsolidatePaginated, EncodeDataURL } from "../utils.js"
import { OAuth2PKCEAuth } from "../authTypes/OAuth2PKCEAuth.js"

export class Picarto extends Provider(OAuth2PKCEAuth){
	Payload(auth){
		return {headers:{"authorization":`${auth["token_type"] ?? "Bearer"} ${auth["access_token"]}`}}
	}

	async GetUIDAndName(auth){
		const username = (await WebRequest.GET("https://api.picarto.tv/api/v1/user", this.Payload(auth)))["channel_details"]["name"]
		return [username, username]
	}

	async FetchStreams(auth, UID){
		const opts = this.Payload(auth)
		const followed = (await Promise.all(["https://api.picarto.tv/api/v1/user/following", "https://api.picarto.tv/api/v1/user/subscriptions"].map(async api=>{
			return ConsolidatePaginated(pageNum=>WebRequest.GET((EncodeDataURL(api, {"page":pageNum, "priority_online":true})), opts), data=>!data["online"], 1) 
		}), true)).flat().map(s=>s["user_id"])
		return (await WebRequest.GET("https://api.picarto.tv/api/v1/online?adult=true&gaming=true", opts)).filter(s=>s["following"] || followed.indexOf(s["user_id"]) > -1).map(s=>[
			s["name"],
			"https://picarto.tv/"+s["name"],
			s["avatar"],
			s["title"].trim()
		])
	}
}