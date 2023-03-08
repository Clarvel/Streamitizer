import { Settings } from "../settings.js"
import { LoadI18nTextToElem, PromiseAll } from "../utils.js"
import { Browser } from "../browser.js"
import { StreamClientController } from "../streamingService.js"

const ACTIVE_STREAMS_KEY = "ActiveStreams"
const MERGE_SAME_NAME = "mergeSameName"
const THEME = "theme"
const DESC_SPEED = "descSpeed"

const SINGLE_TEMPLATE = document.getElementById("singleStreamTemplate").content
const STREAMING_TEMPLATE = document.getElementById("streamingTemplate").content
const ICON_TEMPLATE = document.getElementById("streamIconTemplate").content
const DROP_TEMPLATE = document.getElementById("streamDropdownItemTemplate").content

const STREAMING_CONTAINER = document.getElementById("streamsContainer")
const ERRORS_CONTAINER = document.getElementById("errorsContainer")
const ERRORS_HEADER = document.getElementById("errorsHeader")
/**
 * @type {Settings}
 */
let SETTINGS = null

/**
 * @type {StreamClientController}
 */
let ACCOUNTS_CONTROLLER = null

window.onload = async ()=>{
    ACCOUNTS_CONTROLLER ??= await StreamClientController.Create()
    ACCOUNTS_CONTROLLER.OnUpdate(OnSettingsUpdate)
	SETTINGS ??= await Settings.Create(undefined, undefined, [ACTIVE_STREAMS_KEY])
    Browser.ApplyTheme(await SETTINGS.Get(THEME))
    //SETTINGS.OnUpdate(OnSettingsUpdate)

    LoadI18nTextToElem(document.getElementById("popupHeader"), "pl_currentStreaming", [0])
    
    document.getElementById("optionsButton").addEventListener("click", Browser.OpenOptionsPage)

    await UpdateActiveStreams(await ACCOUNTS_CONTROLLER.GetCachedStreams(undefined, await SETTINGS.Get(MERGE_SAME_NAME)))
}

async function OnSettingsUpdate(changes){
    for(const [key, val] of Object.entries(changes)){
        //console.log(key, val, changes, Object.entries(changes))
        switch(key){
            case ACTIVE_STREAMS_KEY:
                await UpdateActiveStreams(changes)
        }
    }
}


async function UpdateActiveStreams(changes){ // TODO fix how popup handles updates!!!
    // need to use Array.from because getElementsByClassName is not iterable (yet)
    //const existingIDs = new Set(Array.from(STREAMING_CONTAINER.getElementsByClassName("list-group-item")).map(e=>e.id))
    STREAMING_CONTAINER.textContent = ""
    console.log(changes)
    let activeStreamElems = await PromiseAll(changes.map(([n, d])=>CreateStreamElem(n, d)))

    console.log(activeStreamElems)

    LoadI18nTextToElem(document.getElementById("popupHeader"), activeStreamElems.length === 1 ? "pl_singleStreaming" : "pl_currentStreaming", [activeStreamElems.length])
    STREAMING_CONTAINER.append(...activeStreamElems)

    let errs = await ACCOUNTS_CONTROLLER.GetErrors()
    if(errs.length > 0){
        ERRORS_HEADER.style.display = ""
        ERRORS_CONTAINER.style.display = ""
        LoadI18nTextToElem(document.getElementById("errorsHeader"), "pl_currentErrors", [errs.length])
        ERRORS_CONTAINER.textContent = ""
        // TODO: add errors here
    }else{
        ERRORS_HEADER.style.display = "none"
        ERRORS_CONTAINER.style.display = "none"
    }
}

/**
 * @param {string} name
 * @param {{string:[Link:string, Icon:string, Desc:string]}} data 
 */
async function CreateStreamElem(name, data){
    console.log(name, data)
    if(Object.keys(data).length === 1){
        const [type, [link, icon, desc]] = Object.entries(data)[0]
        const elem = document.importNode(SINGLE_TEMPLATE, true)
        elem.firstElementChild.addEventListener("click", (e)=>{e.stopPropagation();OpenStream(link)})
        elem.querySelector(".title").textContent = name
        elem.querySelector(".desc").textContent = desc.trim()
        const img = elem.querySelector(".accountIcon")
        img.title = type
        img.style.setProperty("--url", `url('/icons/${type}.png')`)
        //img.src = icon
        img.style.backgroundImage = `url('${icon}')`
        //elem.querySelector(".sourceIcon").src = `/icons/${type}.png`
        return elem
    }
    const elem = document.importNode(STREAMING_TEMPLATE, true)
    //elem.firstElementChild.id = name

    elem.querySelector(".title").textContent = name

    const icons = []
    const dropdowns = []
    Object.entries(data).forEach(([type, [link, icon, desc]])=>{
        const iconElem = document.importNode(ICON_TEMPLATE, true)
        iconElem.firstElementChild.addEventListener("click", (e)=>{e.stopPropagation();OpenStream(link)})
        iconElem.querySelector(".desc").textContent = desc.trim()
        const img = iconElem.querySelector(".accountIcon")
        img.title = type
        img.style.setProperty("--url", `url('/icons/${type}.png')`)
        img.style.backgroundImage = `url('${icon}')`
        icons.append(iconElem)

        const dropItemElem = document.importNode(DROP_TEMPLATE, true)
        const droplink = dropItemElem.querySelector("a")
        droplink.href = link
        droplink.textContent = type
        dropdowns.append(dropItemElem)
    })

    elem.querySelector(".streams").append(...icons)
    elem.querySelector("ul.dropdown-menu").append(...dropdowns)

    return elem
}

async function OpenStream(link){
    Browser.OpenInNewTab(link)
}

addEventListener("resize", async ()=>{
    SETTINGS ??= await Settings.Create(undefined, undefined, [ACTIVE_STREAMS_KEY])
    const descSpeed = await SETTINGS.Get(DESC_SPEED)

    document.querySelectorAll(".desc").forEach(e => {
        const width = e.offsetWidth
        if(width > e.parentElement.offsetWidth){
            e.setAttribute("data-marquee", e.textContent)
            e.style.setProperty("--duration", `${width / descSpeed}s`)
        }
    })
})
