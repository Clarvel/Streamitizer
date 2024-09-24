import { MetadataSettings } from "../settings.js"
import { LoadI18nTextToElem } from "../utils.js"
import { Browser } from "../browser.js"
import { FlatClientsData, StreamsService } from "../streamsService.js"
import { DESC_SPEED, THEME } from "../IDs.js"


const SINGLE_TEMPLATE = document.getElementById("singleStreamTemplate").content

const STREAMING_CONTAINER = document.getElementById("streamsContainer")
const ERRORS_CONTAINER = document.getElementById("errorsContainer")
const ERRORS_HEADER = document.getElementById("errorsHeader")

const SETTINGS = new MetadataSettings("../options.json")

async function LoadStreamsContainer(){
	STREAMING_CONTAINER.textContent = ""
	STREAMING_CONTAINER.append(...FlatClientsData(await StreamsService.GetCachedStreams()).map(([title, link, icon, desc]) => {
		const elem = document.importNode(SINGLE_TEMPLATE, true)
		elem.firstElementChild.addEventListener("click", (e)=>{
			e.stopPropagation()
			Browser.OpenInNewTab(link)
		})
		elem.querySelector(".title").textContent = title
		elem.querySelector(".desc").textContent = desc.trim()
		const img = elem.querySelector(".accountIcon")
		img.title = title
		//img.style.setProperty("--url", `url('/icons/${provider}.png')`)
		img.style.backgroundImage = `url('${icon}')`
		return elem
	}))

	LoadI18nTextToElem(document.getElementById("popupHeader"), STREAMING_CONTAINER.childElementCount === 1 ? "currentStream" : "currentStreams", [STREAMING_CONTAINER.childElementCount])

	const errsCount = await StreamsService.ErrsCount()
	if(errsCount > 0){
		ERRORS_HEADER.style.display = ""
		ERRORS_CONTAINER.style.display = ""
		LoadI18nTextToElem(document.getElementById("errorsHeader"), errsCount === 1 ? "currentError" : "currentErrors", [errsCount])
		ERRORS_CONTAINER.textContent = ""
		// TODO: add errors here
	}else{
		ERRORS_HEADER.style.display = "none"
		ERRORS_CONTAINER.style.display = "none"
	}
}

addEventListener("resize", async ()=>{
	const descSpeed = await SETTINGS.GetSingle(DESC_SPEED)
	document.querySelectorAll(".desc").forEach(e => {
		const width = e.offsetWidth
		if(width > e.parentElement.offsetWidth){
			e.setAttribute("data-marquee", e.textContent)
			e.style.setProperty("--duration", `${width / descSpeed}s`)
		}
	})
})

window.onload = async ()=>{
	SETTINGS.GetSingle(THEME).then(Browser.ApplyTheme)
	LoadI18nTextToElem(document.getElementById("popupHeader"), "currentStreams", [0])
	document.getElementById("optionsButton").addEventListener("click", Browser.OpenOptionsPage)
	await LoadStreamsContainer()
}