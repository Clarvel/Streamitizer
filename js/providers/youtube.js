import { NoAuth } from "../authTypes/noAuth.js"
import { Provider } from "../provider.js"

export class Youtube extends Provider(NoAuth){
	async GetUIDAndName(auth){
		const username = "[CurrentUser]" //(await (await fetch("https://www.youtube.com/account")).text()).match(/"name" ?: ?"(.+?)"/)?.[1]
		console.debug(username)
		return [username, username]
	}

	async FetchStreams(auth, UID){
		let json = JSON.parse((await (await fetch("https://www.youtube.com/feed/subscriptions")).text()).match(/var ytInitialData = ({.+?});/)?.[1])
		console.debug(json)
		json = json?.["contents"]?.["twoColumnBrowseResultsRenderer"]?.["tabs"]?.[0]?.["tabRenderer"]?.["content"]
		?.["richGridRenderer"]?.["contents"]?.map(i=>i["richItemRenderer"]?.["content"]?.["videoRenderer"]).filter(i=>i?.["badges"]?.[0]?.["metadataBadgeRenderer"]?.["label"] === "LIVE")
		let streams = json?.map(i=>{
			return [
				i["ownerText"]["runs"][0]["text"],
				"https://youtube.com/watch?v=" + i["videoId"],
				i["avatar"]["decoratedAvatarViewModel"]["avatar"]["avatarViewModel"]["image"]["sources"][0]["url"],
				i["title"]["runs"][0]["text"].trim()
			]
		}) ?? []
		console.debug(streams)
		return streams
	}
}