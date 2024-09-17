## Implementation
* Authenticate with user account
* for each streaming account
	* periodically poll for followed streams that are live
	* consolidate fetched streams per streaming site
* display to user

## TODO: Known Issues
* Youtube does not utilize an API and is dependent on HTML scraping
* Twitch and Picarto aren't setup to redirect properly in Firefox, as they need new client id/secret setup

options can be disabled by adding `"disabled":true` to the relevant section of `options.json`


## Streaming Sites
### Picarto
OAuth2 (PKCE)
https://oauth.picarto.tv/client

### Twitch
Modified OAuth2
uses Bearer tokens
https://dev.twitch.tv/console/

### Youtube
OAuth2 (PKCE?)
uses bearer tokens
https://console.cloud.google.com/home/dashboard

let userdata = WebRequest.GET("https://youtube.googleapis.com/youtube/v3/channels", undefined, {"part":"snippet", "mine":true, "key":API_KEY})["items"][0]
let id = userdata["id"] = UCIk_A0ejw8nqBnI6XiLf0sA
let username = userdata["snippet"]["localized"]["title"]
let avatar = userdata["snippet"]["thumbnails"]["default"]["url"]

let subscriptions = GET https://youtube.googleapis.com/youtube/v3/subscriptions?part=snippet%2CcontentDetails&mine=true&key=[YOUR_API_KEY] HTTP/1.1

let streams = GET https://youtube.googleapis.com/youtube/v3/channels?part=snippet%2CcontentDetails%2Cstatistics&mine=true&key=[YOUR_API_KEY] HTTP/1.1

* UGH, this isn't working, youtube's API endpoints don't make it easy(or possible?) to get a list of followed channels that are streaming. Just gonna scrape the subscriptions page.

### Piczel
personal tokens: https://piczel.tv/account/personal-tokens
API documentation: https://documenter.getpostman.com/view/12122005/2sA3e49od8