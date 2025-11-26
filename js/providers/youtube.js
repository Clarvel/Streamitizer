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
		?.["richGridRenderer"]?.["contents"]?.map(i=>i["richItemRenderer"]?.["content"]?.["lockupViewModel"]?.["metadata"]?.["lockupMetadataViewModel"])
		if(!Array.isArray(json))
			throw Error("Youtube Fetch could not find Stream Data")
		let streams = json.filter(i=>i?.["image"]?.["decoratedAvatarViewModel"]?.["liveData"]?.["liveBadgeText"] === "LIVE")?.map(i=>{
			return [
				i["metadata"]["contentMetadataViewModel"]["metadataRows"][0]["metadataParts"][0]["text"]["content"],
				"https://youtube.com/watch?v=" + i["image"]["decoratedAvatarViewModel"]["rendererContext"]["commandContext"]["onTap"]["innertubeCommand"]["watchEndpoint"]["videoId"],
				i["image"]["decoratedAvatarViewModel"]["avatar"]["avatarViewModel"]["image"]["sources"][0]["url"],
				i["title"]["content"].trim()
			]
		}) ?? []
		console.debug(streams)
		return streams
	}
}