import { OAuth2PKCEAuth } from "../authTypes/OAuth2PKCEAuth.js"
import { Provider } from "../provider.js"
import { AsyncFilter } from "../utils.js"
import { WebRequest } from "../webRequest.js"

export class Youtube extends Provider(OAuth2PKCEAuth){
	Payload(auth){
		return {headers:{"authorization":`${auth["token_type"] ?? "Bearer"} ${auth["access_token"]}`}}
	}

	async GetUIDAndName(auth){
		var userData = (await WebRequest.GET("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", this.Payload(auth)))["items"][0]
		return [userData["id"], userData["snippet"]["title"]]
	}

	async FetchStreams(auth, UID){
		const re = /<meta (?:itemprop="datePublished" content="(.+?)"|content="(.+?)" itemprop="datePublished")>/
		const snippets = (await WebRequest.GET("https://www.googleapis.com/youtube/v3/subscriptions?part=snippet,subscriberSnippet&mine=true&order=unread&maxResults=50", this.Payload(auth)))["items"].map(s=>s["snippet"])
		const filtered = await AsyncFilter(snippets, async s => {
			const url = s["_url"] = `https://www.youtube.com/${s["channelId"]}/live` // this doesn't work ;_;
			const dateStr = re.exec((await fetch(url)))
			return dateStr && Date.parse(dateStr) <= Date.now()
		})
		const streams = filtered.map(s=>[
			s["channelTitle"],
			s["_url"],
			s["thumbnails"]["default"]["url"],
			s["title"]
		])
		console.log(snippets, filtered, streams)
		return streams
	}
}