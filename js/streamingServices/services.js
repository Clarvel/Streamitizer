import { Picarto } from "./Picarto.js"
import { Piczel } from "./Piczel.js"
import { Twitch } from "./Twitch.js"
import { Youtube } from "./youtube.js"

/**
 * To add a new service:
 * - Create a config for it in ../../services.json
 * - Create a new .js file for it in this folder, extending a ServiceInterface class
 * - Add an entry here with the string name used for your service in services.json and import your .js file class
 */
export const ServiceMapping = {
	[Piczel.Type]:Piczel,
	[Picarto.Type]:Picarto,
	[Twitch.Type]:Twitch,
	[Youtube.Type]:Youtube
}