import { NoAuth } from "../AuthenticationClients/NoAuth.js"
import { GenericStreamClient } from "./GenericStreamClient.js"

export class Youtube extends GenericStreamClient{
	static AuthClientType = NoAuth
	static Type = "youtube"

	async _GetUsername(authentication){
		return (await (await fetch("https://www.youtube.com/account")).text()).match(/"name" ?: ?"(.+?)"/)?.[1]
	}

	async _GetActiveStreams(authentication){
		return JSON.parse((await (await fetch("https://www.youtube.com/feed/subscriptions")).text()).match(/var ytInitialData = ({.+?});/)?.[1])?.["contents"]?.["twoColumnBrowseResultsRenderer"]?.["tabs"]?.[0]?.["tabRenderer"]?.["content"]?.["sectionListRenderer"]?.["contents"]?.[0]?.["itemSectionRenderer"]?.["contents"]?.[0]?.["shelfRenderer"]?.["content"]?.["gridRenderer"]?.["items"]?.filter(i=>i["gridVideoRenderer"]?.["badges"]?.[0]?.["metadataBadgeRenderer"]?.["label"] === "LIVE")?.map(i=>{
			const item = i["gridVideoRenderer"]
			return [
				item["shortBylineText"]["runs"][0]["text"],
				"https://youtube.com/watch?v=" + item["videoId"],
				item["channelThumbnail"]["thumbnails"][0]["url"],
				item["title"]["runs"][0]["text"]
			]
		}) ?? []
	}

	/*
	async _GetUsername(authentication){
		var result = (await WebRequest.GET("https://content-youtube.googleapis.com/youtube/v3/channels?mine=true&part=snippet", {headers: {"Authorization":`Bearer ${authentication["access_token"]}`}}))["items"][0]
		console.log(result["id"])
		return result["snippet"]?.["localized"]?.["title"] ?? result["snippet"]["title"]
	}
	*/
	/*async _GetActiveStreamsFromAPI(){
		var results = {}
		var raw = await WebRequest.GET("https://content-youtube.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50", {headers: {"Authorization":`Bearer ${authentication["access_token"]}`}})
		var nextPage = raw["nextPageToken"]
		raw["items"].forEach(item => {
			console.log(item)
			results[item["snippet"]["resourceId"]["channelId"]] = item["snippet"]//{title:item["title"], desc:item["description"], icon:item["thumbnails"]["default"]["url"]}
		});
		while(nextPage){
			raw = await WebRequest.GET("https://content-youtube.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50&pageToken=" + nextPage, {headers: {"Authorization":`Bearer ${authentication["access_token"]}`}})
			nextPage = raw["nextPageToken"]
			raw["items"].forEach(item => {
				results[item["snippet"]["resourceId"]["channelId"]] = item["snippet"]//{title:item["title"], desc:item["description"], icon:item["thumbnails"]["default"]["url"]}
			});
		}

		Object.entries(results).forEach(async ([key, result])=>{
			const text = await(await fetch(`https://youtube.com/channel/${result["resourceId"]["channelId"]}/live`)).text()
			const match = text.match(/<link rel="canonical" href="(https:\/\/www\.youtube\.com\/watch\?v=.+?)">/)?.[1]
			if(match){
				console.log("Streaming: " + result["title"], match)
			}
		})
		return []
	}*/
}
