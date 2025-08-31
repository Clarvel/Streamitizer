import { MetadataSettings } from "../settings.js"
import { LoadI18nTextToElem } from "../utils.js"
import { Browser } from "../browser.js"
import { StreamsService } from "../streamsService.js"
import { DESC_SPEED, THEME, MULTIPLE_NOTIFS_ID } from "../IDs.js"


const MULTIPLE_TEMPLATE = document.getElementById("multipleStreamTemplate").content
const M_STREAM_TEMPLATE = document.getElementById("streamTemplate").content

const STREAMING_CONTAINER = document.getElementById("streamsContainer")
const ERRORS_CONTAINER = document.getElementById("errorsContainer")
const ERRORS_HEADER = document.getElementById("errorsHeader")

const SETTINGS = new MetadataSettings("../options.json")


async function LoadStreamsContainer(){
	function setLink(elem, link){
		elem.href = link
		if(location.hash !== MULTIPLE_NOTIFS_ID)
			elem.target = '_blank'
	}
	STREAMING_CONTAINER.textContent = ""
	STREAMING_CONTAINER.append(...(await StreamsService.GetRemappedStreams()).flatMap(([title, providers])=>{
		const elem = document.importNode(MULTIPLE_TEMPLATE, true)
		const img = elem.querySelector(".accountIcon")
		img.title = title
		elem.querySelector(".title").textContent = title
		const [link0, [provider0, icon0, desc0]] = Object.entries(providers)[0]
		img.style.backgroundImage = `url('${icon0}')`
		setLink(elem.querySelector('a'), link0)
		elem.querySelector(".streamsList").append(...Object.entries(providers).flatMap(([link, [provider, icon, desc]])=>{
			const elem1 = document.importNode(M_STREAM_TEMPLATE, true)
			elem1.querySelector(".desc").textContent = desc.trim()
			setLink(elem1.querySelector('a'), link)
			const sIcon = elem1.querySelector(".subIcon")
			sIcon.src = `/icons/${provider}.png`
			sIcon.title = title
			return elem1
		}))
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