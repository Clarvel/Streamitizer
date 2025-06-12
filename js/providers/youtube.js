import { OAuth2PKCEAuth } from "../authTypes/OAuth2PKCEAuth.js"
import { Provider } from "../provider.js"
import { AsyncFilter } from "../utils.js"
import { WebRequest } from "../webRequest.js"

export class Youtube extends Provider(OAuth2PKCEAuth){
	Payload(auth){
		return {headers:{"authorization":`${auth["token_type"] ?? "Bearer"} ${auth["access_token"]}`}}
	}
	async Authenticate(manuallyTriggered=false, request={}){
		request["access_type"] = "offline"
		if(manuallyTriggered)
			request["prompt"] = "select_account" // TODO: change to "login_hint" once I can get that info!
		return super.Authenticate(manuallyTriggered, request)
	}
	async GetUIDAndName(auth){
		console.log(auth)
		var userData = (await WebRequest.GET("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&fields=items(id,snippet/title)", this.Payload(auth)))["items"][0]
		return [userData["id"], userData["snippet"]["title"]]
	}

	async FetchStreams(auth, UID){
		// TODO: this only gets 50 results, needs paging to get moar
		const snippets = (await WebRequest.GET("https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&order=unread&maxResults=50&fields=items(snippet(title,resourceId/channelId,thumbnails/default/url))", this.Payload(auth)))["items"].map(s=>s["snippet"])
		const filtered = await AsyncFilter(snippets, async s => {
			const url = s["_url"] = `https://www.youtube.com/channel/${s["resourceId"]["channelId"]}/live`
			const metadata = Object.fromEntries((await fetch(url).then(r=>r.text())).matchAll(/<meta (\w+?)="(.*?)" (\w+?)="(.*?)">/g).map(m=>[m[m.indexOf("itemprop")+1], m[m.indexOf("content")+1]]))

			const dateStr = metadata["datePublished"]
			s["_desc"] = metadata["name"]
			return dateStr && Date.parse(dateStr) <= Date.now()
		})
		const streams = filtered.map(s=>[
			s["title"],
			s["_url"],
			s["thumbnails"]["default"]["url"],
			s["_desc"].trim()
		])
		console.log(snippets, filtered, streams)
		return streams
	}
}